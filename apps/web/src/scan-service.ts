import { sha256Bytes } from "../../../packages/core/src/hash.ts";
import { auditSkillPackage } from "../../../packages/skill-audit/src/audit.ts";
import { canonicalSkillPackageBytes } from "../../../packages/skill-audit/src/package.ts";
import type { SkillAuditFinding, SkillPackageEntry } from "../../../packages/skill-audit/src/model.ts";
import {
  deriveVerdictFromHighestSeverity,
  type CatalogStore,
  type PastedSkillDeterministicFinding,
  type PastedSkillScanVerdict,
} from "../../../packages/catalog-store/src/index.ts";
import { createLiveZeroGComputeTransport, runAdvisoryScan, type AdvisoryScanTransport, type ZeroGComputeConfig } from "../../../packages/compute-0g/src/index.ts";
import type { FixedWindowRateLimiter } from "./rate-limit.ts";

/** Kept local (not `ApiV1Error` from `api-v1.ts`) so this module has no import-cycle with
 * `api-v1.ts` (which imports `performPastedSkillScan` from here to implement `POST
 * /api/v1/scan`) — the same reason `errors.ts`/`ProductRequestError` exists. `api-v1.ts` and
 * `mcp.ts` both translate this into their own response shape at their respective boundaries. */
export class ScanServiceError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: string, message: string, status = 400, details?: unknown) {
    super(message);
    this.name = "ScanServiceError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/**
 * "Paste-to-scan" skill screening (new feature; see PR description). Anyone — a human on the
 * website, or an AI agent via the `aegisone_scan` MCP tool — submits raw Agent Skill content
 * directly (no GitHub repo, no claimed publisher identity, no discovery step) and gets back a
 * deterministic Tier-1 security screening verdict, plus an optional non-authoritative Tier-2
 * advisory pass over 0G Compute.
 *
 * This is explicitly NOT the GitHub-source-claim correspondence flow (M8.5/M8.6/M8.7): a pasted
 * skill has no claimed publisher and no claimed source, so nothing in this module ever produces
 * `sourceAssurance` above `NONE` or a `correspondence` value other than `NOT_EVALUATED` — there is
 * no source-claim/version row for this path to attach evidence to in the first place, so
 * MATCH/MISMATCH/REPOSITORY_AUTHENTICATED/SIGNED_RELEASE are structurally unreachable here (see
 * `apps/web/test/scan-service.test.ts` for a source-inspection-style structural regression test).
 */

const MAX_SCAN_BODY_BYTES = 256 * 1024;
const MAX_SCAN_FILES = 50;
const MAX_STORED_FINDINGS = 200;
const MAX_ADVISORY_TEXT_CHARS = 40_000;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toStoredFinding(finding: SkillAuditFinding): PastedSkillDeterministicFinding {
  return { ruleId: finding.ruleId, title: finding.title, severity: finding.severity, path: finding.path, line: finding.line, evidence: finding.evidence };
}

/** Parses `content` into canonical skill-package entries. Accepts either a single-file quick
 * paste (a plain string, treated as `SKILL.md`) or a small multi-file package (an array of
 * `{ path, content }` objects) — see PR description "API surface". Bounded/firm total-size and
 * file-count caps (docs/17-m8-security-boundaries.md Threat M8-015): 256 KiB total content and at
 * most 50 files, generous enough for real Agent Skill packages (which are typically a SKILL.md
 * plus a handful of small scripts) while remaining a fixed, documented, anonymous-caller-safe
 * bound — the same "public body limit" discipline as `/search`'s 32 KiB and `/mcp`'s 256 KiB. */
export function parseScanContent(raw: unknown): SkillPackageEntry[] {
  if (typeof raw === "string") {
    if (raw.trim() === "") throw new ScanServiceError("invalid_request", "content must not be empty");
    const bytes = new TextEncoder().encode(raw);
    if (bytes.byteLength > MAX_SCAN_BODY_BYTES) {
      throw new ScanServiceError("request_too_large", `content exceeds the ${MAX_SCAN_BODY_BYTES}-byte limit`, 413);
    }
    return [{ path: "SKILL.md", bytes }];
  }

  if (Array.isArray(raw)) {
    if (raw.length === 0) throw new ScanServiceError("invalid_request", "content array must not be empty");
    if (raw.length > MAX_SCAN_FILES) throw new ScanServiceError("invalid_request", `content array must have at most ${MAX_SCAN_FILES} files`);

    const entries: SkillPackageEntry[] = [];
    let totalBytes = 0;
    for (const item of raw) {
      if (!isObject(item) || typeof item.path !== "string" || item.path.trim() === "" || typeof item.content !== "string") {
        throw new ScanServiceError("invalid_request", "each content item must be { path: string, content: string }");
      }
      const bytes = new TextEncoder().encode(item.content);
      totalBytes += bytes.byteLength;
      if (totalBytes > MAX_SCAN_BODY_BYTES) throw new ScanServiceError("request_too_large", `content exceeds the ${MAX_SCAN_BODY_BYTES}-byte limit`, 413);
      entries.push({ path: item.path, bytes });
    }
    return entries;
  }

  throw new ScanServiceError("invalid_request", "content must be a string or an array of {path, content} objects");
}

function canonicalizeEntries(entries: SkillPackageEntry[]): { bytes: Uint8Array; contentSha256: string } {
  let bytes: Uint8Array;
  try {
    bytes = canonicalSkillPackageBytes(entries);
  } catch (error) {
    throw new ScanServiceError("invalid_request", error instanceof Error ? error.message : "malformed content", 400);
  }
  return { bytes, contentSha256: sha256Bytes(bytes) };
}

function extractAdvisoryText(entries: readonly SkillPackageEntry[]): string {
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const parts: string[] = [];
  let remaining = MAX_ADVISORY_TEXT_CHARS;
  // SKILL.md first (the primary declared-instructions surface), then everything else in
  // canonical (sorted) order, matching what a reader/agent would actually see.
  const ordered = [...entries].sort((a, b) => (a.path === "SKILL.md" ? -1 : b.path === "SKILL.md" ? 1 : a.path.localeCompare(b.path)));
  for (const entry of ordered) {
    if (remaining <= 0) break;
    let text: string;
    try {
      text = decoder.decode(entry.bytes);
    } catch {
      continue; // binary/non-UTF-8 file: not meaningful advisory input, skip rather than fail.
    }
    const chunk = `=== ${entry.path} ===\n${text}\n`;
    parts.push(chunk.slice(0, remaining));
    remaining -= chunk.length;
  }
  return parts.join("\n");
}

export interface AdvisoryFindingsField {
  readonly status: "completed" | "advisory_unavailable" | "rate_limited" | "error";
  readonly finding?: { readonly summary: string; readonly concernLevel: string; readonly modelProvider: string; readonly ranAt: string };
  readonly reason?: string;
  readonly message?: string;
}

export interface InspectedFileSummary {
  readonly path: string;
  readonly byteLength: number;
}

export interface InspectedSummary {
  readonly fileCount: number;
  readonly totalBytes: number;
  readonly files: readonly InspectedFileSummary[];
}

export interface ScanApiResponse {
  readonly schemaVersion: "1";
  readonly contentSha256: string;
  readonly verdict: PastedSkillScanVerdict;
  readonly cached: boolean;
  /**
   * Plain-English report requirement (PR 2/4): exactly what AegisOne inspected, additive to the
   * existing contract (docs/20-m8-api-contract.md) — every existing field is unchanged, this is a
   * new field a caller that does not know about it can simply ignore.
   */
  readonly inspected: InspectedSummary;
  readonly deterministicFindings: readonly PastedSkillDeterministicFinding[];
  /**
   * `null` only when `includeAdvisoryScan` was not requested. When requested, this is ALWAYS
   * populated with an explicit status — never silently omitted, and never a bare boolean. This
   * field is purely informational: it never sets/overrides `verdict`, `correspondence`, or
   * `sourceAssurance` anywhere in this module (see the structural regression test in
   * apps/web/test/scan-service.test.ts).
   */
  readonly advisoryFindings: AdvisoryFindingsField | null;
  readonly scanCount: number;
}

export interface ScanServiceDependencies {
  readonly catalogStore: CatalogStore;
  /** `null` means no `ZEROG_COMPUTE_PRIVATE_KEY` is configured in this environment — every
   * `includeAdvisoryScan: true` request then returns an explicit `advisory_unavailable` state. */
  readonly zeroGComputeConfig: ZeroGComputeConfig | null;
  /** Overridable for tests; defaults to the real (untested-live) 0G Compute transport built from
   * `zeroGComputeConfig` when present. */
  readonly advisoryTransport?: AdvisoryScanTransport;
  readonly scanRateLimiter: FixedWindowRateLimiter;
  readonly advisoryRateLimiter: FixedWindowRateLimiter;
}

/**
 * The single paste-to-scan service used by both `POST /api/v1/scan` and the `aegisone_scan` MCP
 * tool — mirroring the existing `performCapabilitySearch`/`runPolicyEvaluation` "MCP calls the
 * same validated application service as REST" pattern (M8.8).
 *
 * `rateLimitKey` identifies the caller for both the Tier-1 scan limiter and the (stricter) Tier-2
 * advisory limiter — callers pass the remote IP (REST) or a fixed per-transport key (MCP, which
 * has no per-caller IP of its own beyond the underlying HTTP connection; `mcp.ts` passes the same
 * remote-IP key the REST route would for the same connection).
 */
export async function performPastedSkillScan(rawBody: unknown, deps: ScanServiceDependencies, rateLimitKey: string): Promise<ScanApiResponse> {
  if (!isObject(rawBody)) throw new ScanServiceError("invalid_request", "request body must be a JSON object");
  if (rawBody.includeAdvisoryScan !== undefined && typeof rawBody.includeAdvisoryScan !== "boolean") {
    throw new ScanServiceError("invalid_request", "includeAdvisoryScan must be a boolean when present");
  }
  const includeAdvisoryScan = rawBody.includeAdvisoryScan === true;

  if (!deps.scanRateLimiter.consume(rateLimitKey)) {
    throw new ScanServiceError("scan_rate_limited", "Too many scan requests from this client; try again later.", 429);
  }

  const entries = parseScanContent(rawBody.content);
  const { contentSha256 } = canonicalizeEntries(entries);

  const report = auditSkillPackage(entries);
  const verdict = deriveVerdictFromHighestSeverity(report.highestSeverity);
  const findings = report.findings.slice(0, MAX_STORED_FINDINGS).map(toStoredFinding);

  const { scan, cached } = await deps.catalogStore.createOrTouchPastedSkillScan({
    contentSha256,
    verdict,
    highestSeverity: report.highestSeverity,
    findingCount: report.findingCount,
    findings,
  });

  let advisoryFindings: AdvisoryFindingsField | null = null;
  if (includeAdvisoryScan) {
    if (!deps.zeroGComputeConfig && !deps.advisoryTransport) {
      advisoryFindings = { status: "advisory_unavailable", reason: "ZEROG_COMPUTE_PRIVATE_KEY is not configured in this environment" };
    } else if (!deps.advisoryRateLimiter.consume(rateLimitKey)) {
      advisoryFindings = { status: "rate_limited", reason: "Advisory scan rate limit exceeded for this client" };
    } else {
      const transport = deps.advisoryTransport ?? createLiveZeroGComputeTransport(deps.zeroGComputeConfig!);
      const outcome = await runAdvisoryScan(extractAdvisoryText(entries), transport);
      advisoryFindings =
        outcome.status === "completed"
          ? { status: "completed", finding: outcome.finding }
          : { status: "error", message: outcome.message };
    }
  }

  const inspected: InspectedSummary = {
    fileCount: entries.length,
    totalBytes: entries.reduce((sum, entry) => sum + entry.bytes.byteLength, 0),
    files: entries.map((entry) => ({ path: entry.path, byteLength: entry.bytes.byteLength })),
  };

  return {
    schemaVersion: "1",
    contentSha256,
    verdict: scan.verdict,
    cached,
    inspected,
    deterministicFindings: scan.findings,
    advisoryFindings,
    scanCount: scan.scanCount,
  };
}
