import { spawn } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalSkillPackageBytes } from "../../skill-audit/src/package.ts";
import type { SkillPackageEntry } from "../../skill-audit/src/model.ts";

async function run(command: string, args: string[], cwd: string): Promise<void> {
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "ProofRail Fixture",
        GIT_AUTHOR_EMAIL: "fixture@proofrail.test",
        GIT_COMMITTER_NAME: "ProofRail Fixture",
        GIT_COMMITTER_EMAIL: "fixture@proofrail.test",
      },
    });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk.toString(); });
    child.stderr.on("data", (chunk) => { output += chunk.toString(); });
    child.once("error", reject);
    child.once("close", (code) => (code === 0 ? resolvePromise() : reject(new Error(`${command} ${args.join(" ")} failed: ${output}`))));
  });
}

const SKILL_MD = `---
name: fixture-skill
description: A deterministic fixture Agent Skill used only by skill-verification-link tests.
license: MIT
---

# Fixture Skill

1. Read the requested input.
2. Return a deterministic fixture response.
`;

/** Creates a throwaway local Git repository containing `fixture-skill/SKILL.md`, commits it,
 * and returns the repository path plus the exact commit SHA. Local-path "remotes" are only
 * accepted by `inspectSourceOnly` when `allowLocalFixtureRepository: true` is passed. */
export async function createFixtureGitRepository(skillMarkdown: string = SKILL_MD): Promise<{ repositoryPath: string; commitSha: string; subdirectory: string }> {
  const root = await mkdtemp(join(tmpdir(), "proofrail-skill-fixture-repo-"));
  await run("git", ["init", "--quiet", "--initial-branch=main"], root);
  await run("git", ["config", "core.autocrlf", "false"], root);
  await run("git", ["config", "core.eol", "lf"], root);
  const skillDir = join(root, "fixture-skill");
  await mkdir(skillDir, { recursive: true });
  await writeFile(join(skillDir, "SKILL.md"), skillMarkdown, "utf8");
  await run("git", ["add", "-A"], root);
  await run("git", ["commit", "--quiet", "-m", "fixture skill"], root);
  const commitSha = await new Promise<string>((resolvePromise, reject) => {
    const child = spawn("git", ["rev-parse", "HEAD"], { cwd: root, shell: false, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk.toString(); });
    child.once("close", (code) => (code === 0 ? resolvePromise(output.trim()) : reject(new Error("git rev-parse failed"))));
  });
  return { repositoryPath: root, commitSha, subdirectory: "fixture-skill" };
}

export function genuineDistributionBytesFor(skillMarkdown: string = SKILL_MD): Uint8Array {
  const entries: SkillPackageEntry[] = [{ path: "SKILL.md", bytes: new TextEncoder().encode(skillMarkdown) }];
  return canonicalSkillPackageBytes(entries);
}
