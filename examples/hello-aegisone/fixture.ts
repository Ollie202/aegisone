import { spawn } from "node:child_process";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BuildRecipe, ReleaseClaim } from "../../packages/core/src/model.ts";
import { recipeDigest } from "../../packages/core/src/verify.ts";

const fixtureRoot = import.meta.dirname;

async function git(args: string[], cwd: string): Promise<string> {
  return await new Promise((resolvePromise, reject) => {
    const child = spawn("git", args, {
      cwd,
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "AegisOne Fixture",
        GIT_AUTHOR_EMAIL: "fixture@proofrail.invalid",
        GIT_AUTHOR_DATE: "2026-01-01T00:00:00Z",
        GIT_COMMITTER_NAME: "AegisOne Fixture",
        GIT_COMMITTER_EMAIL: "fixture@proofrail.invalid",
        GIT_COMMITTER_DATE: "2026-01-01T00:00:00Z",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk.toString(); });
    child.stderr.on("data", (chunk) => { output += chunk.toString(); });
    child.once("error", reject);
    child.once("close", (code) => code === 0 ? resolvePromise(output.trim()) : reject(new Error(output)));
  });
}

export async function makeHelloAegisOneFixture(): Promise<{
  cleanup: () => Promise<void>;
  repositoryPath: string;
  commitSha: string;
  recipe: BuildRecipe;
  claim: ReleaseClaim;
  publisherBytes: Uint8Array;
}> {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "proofrail-fixture-"));
  const repositoryPath = join(temporaryRoot, "repository");
  await cp(fixtureRoot, repositoryPath, {
    recursive: true,
    filter: (source) => !source.includes("/fixtures") && !source.endsWith("/fixture.ts"),
  });
  await git(["init", "--quiet"], repositoryPath);
  await git(["add", "package.json", "build.mjs", "src/message.txt"], repositoryPath);
  await git(["commit", "--quiet", "-m", "deterministic hello-proofrail fixture"], repositoryPath);
  const commitSha = await git(["rev-parse", "HEAD"], repositoryPath);
  const recipe: BuildRecipe = {
    version: "1",
    runtime: `node-${process.versions.node.split(".")[0]}`,
    workingDirectory: ".",
    commands: [{ executable: "node", args: ["build.mjs"] }],
    artifactPath: "dist/hello-proofrail.json",
    networkPolicy: "none",
    resourceLimits: { timeoutMs: 5_000, maxOutputBytes: 1_024 },
    environment: {},
  };
  const claim: ReleaseClaim = {
    claimVersion: "1",
    projectId: "hello-proofrail@1.0.0",
    publisherIdentity: {
      type: "anonymous",
      subject: "hello-proofrail fixture publisher",
      assuranceLevel: "DECLARED",
      evidenceReferences: [],
    },
    source: { provider: "git", repository: "fixture://hello-proofrail", commitSha },
    recipeDigest: recipeDigest(recipe),
    artifactName: "hello-proofrail.json",
    artifactLocation: "fixtures/publisher/hello-proofrail.json",
    releaseTag: "v1.0.0",
    claimAssuranceLevel: "DECLARED",
  };
  return {
    cleanup: () => rm(temporaryRoot, { recursive: true, force: true }),
    repositoryPath,
    commitSha,
    recipe,
    claim,
    publisherBytes: await readFile(join(fixtureRoot, "fixtures/publisher/hello-proofrail.json")),
  };
}
