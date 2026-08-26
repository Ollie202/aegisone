import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { auditSkillPackage } from "../../skill-audit/src/audit.ts";
import { readSkillDirectory, summarizeSkillPackage } from "../../skill-audit/src/package.ts";
import { validateSkillPackage } from "../../skill-audit/src/validate.ts";
import type { SkillAuditReport, SkillFormatValidation } from "../../skill-audit/src/model.ts";
import type { SourceAcquisitionRequest, SourceInspectionOutcome } from "./model.ts";

/**
 * Bounded exact-commit Git source acquisition, reusing the same `git clone --no-checkout` +
 * `git checkout --detach <sha>` + `rev-parse HEAD` verification pattern
 * `packages/runner-local/src/run.ts` already uses in the proven M1-M7 build path (never a
 * second downloader/extractor; this is the existing established source-acquisition mechanism,
 * scoped down to "package the checked-out files" instead of "run a build recipe"). `git` is
 * invoked via `spawn` with argument arrays only — never shell interpolation
 * (docs/17-m8-security-boundaries.md Threat M8-016).
 */

const COMMIT_SHA_RE = /^[0-9a-f]{40}$/;
const CLONE_TIMEOUT_MS = 60_000;

export class SourceAcquisitionError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "SourceAcquisitionError";
    this.code = code;
  }
}

/** Production callers must pass a `https://github.com/<owner>/<repo>[.git]` URL — matching the
 * exact stable identity a `source_claims` row records — never an arbitrary fetch target
 * (docs/17 Threat M8-003 MVP rule: "GitHub source acquisition uses parsed GitHub owner/repo
 * identifiers rather than arbitrary fetch URLs"). `allowLocalFixtureRepository` exists only for
 * this package's own tests, which need a throwaway local Git repository as the "remote". */
const GITHUB_HTTPS_RE = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+(?:\.git)?$/;

function assertRepositoryUrl(repositoryUrl: string, allowLocalFixtureRepository: boolean): void {
  if (GITHUB_HTTPS_RE.test(repositoryUrl)) return;
  if (allowLocalFixtureRepository) return;
  throw new SourceAcquisitionError(
    "source_repository_url_not_allowed",
    "source acquisition only supports https://github.com/<owner>/<repo> repository URLs",
  );
}

function subprocess(command: string, args: string[], cwd: string | undefined, timeoutMs: number): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd, shell: false, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk.toString(); });
    child.stderr.on("data", (chunk) => { output += chunk.toString(); });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new SourceAcquisitionError("source_acquisition_timeout", `${command} ${args[0]} exceeded ${timeoutMs}ms`));
    }, timeoutMs);
    child.once("error", (error) => { clearTimeout(timer); reject(error); });
    child.once("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolvePromise(output.trim());
      else reject(new SourceAcquisitionError("git_command_failed", `git ${args[0]} failed (${code}): ${output.slice(0, 2000)}`));
    });
  });
}

function normalizeSubdirectory(subdirectory: string | null): string {
  if (subdirectory === null || subdirectory === "" || subdirectory === ".") return ".";
  const normalized = subdirectory.replaceAll("\\", "/");
  if (normalized.startsWith("/") || normalized.includes("..") || normalized.includes("\0")) {
    throw new SourceAcquisitionError("invalid_source_subdirectory", `unsafe source subdirectory: ${subdirectory}`);
  }
  return normalized;
}

/**
 * Retrieves the exact requested commit and packages the (sub)directory deterministically using
 * the existing `@aegisone/skill-audit` filesystem walker/canonical packer/validator/auditor —
 * never a new packaging or audit implementation. This function never calls
 * `verifySkillPackages`/`compareArtifacts`: there is no `publisherEntries` in scope here, so it
 * is structurally impossible for source-only inspection to produce a `MATCH`/`MISMATCH` value.
 */
export async function inspectSourceOnly(
  request: SourceAcquisitionRequest,
  options: { allowLocalFixtureRepository?: boolean } = {},
): Promise<SourceInspectionOutcome> {
  if (!COMMIT_SHA_RE.test(request.commitSha)) {
    throw new SourceAcquisitionError("invalid_commit_sha", "source acquisition requires a full lowercase 40-character Git commit SHA");
  }
  assertRepositoryUrl(request.repositoryUrl, options.allowLocalFixtureRepository ?? false);
  const subdirectory = normalizeSubdirectory(request.subdirectory);

  const temporaryRoot = await mkdtemp(join(tmpdir(), "aegisone-skill-source-"));
  const checkout = join(temporaryRoot, "source");
  try {
    // -c core.autocrlf=false / core.eol=lf: correspondence must reproduce the exact publisher
    // bytes regardless of the local git installation's line-ending settings, so checkout must
    // never silently rewrite file contents.
    const gitConfig = ["-c", "core.autocrlf=false", "-c", "core.eol=lf"];
    await subprocess("git", [...gitConfig, "clone", "--quiet", "--no-checkout", "--", request.repositoryUrl, checkout], undefined, CLONE_TIMEOUT_MS);
    await subprocess("git", [...gitConfig, "checkout", "--quiet", "--detach", request.commitSha], checkout, CLONE_TIMEOUT_MS);
    const actualCommit = await subprocess("git", ["rev-parse", "HEAD"], checkout, 10_000);
    if (actualCommit.toLowerCase() !== request.commitSha.toLowerCase()) {
      throw new SourceAcquisitionError(
        "source_commit_mismatch",
        `checked out commit ${actualCommit} does not match requested exact commit ${request.commitSha}`,
      );
    }

    const checkoutRoot = resolve(checkout);
    const skillRoot = resolve(checkout, subdirectory);
    if (skillRoot !== checkoutRoot && !skillRoot.startsWith(checkoutRoot + sep)) {
      throw new SourceAcquisitionError("source_subdirectory_escapes_checkout", "source subdirectory escapes the checked-out repository");
    }

    const skill = await readSkillDirectory(skillRoot);
    const format: SkillFormatValidation = validateSkillPackage(skill.entries, skill.directoryName);
    const summary = summarizeSkillPackage(skill.entries);

    return {
      status: "INSPECTED",
      exactCommitSha: actualCommit.toLowerCase(),
      directoryName: skill.directoryName,
      entries: skill.entries,
      sourceSnapshotSha256: summary.sha256,
      format,
    };
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

/** Runs the existing deterministic Agent Skill audit against the source-only package. Exposed
 * separately so callers can label the audit target as `"source"` (there is no publisher package
 * yet) rather than the M7 `"publisher"` convention. */
export function auditSourceInspection(outcome: SourceInspectionOutcome): SkillAuditReport {
  return auditSkillPackage(outcome.entries);
}
