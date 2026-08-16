import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import type { BuildEnvironment, BuildRecipe, SourceRef } from "../../core/src/model.ts";
import { validateBuildRecipe } from "../../core/src/validate.ts";

export interface LocalBuildResult {
  artifactBytes: Uint8Array;
  environment: BuildEnvironment;
  logs: string[];
}

const ALLOWED_EXECUTABLES = new Set(["node"]);

function safeResolve(root: string, relativePath: string): string {
  const output = resolve(root, relativePath);
  if (output !== root && !output.startsWith(root + sep)) throw new Error("Path escapes checked-out source");
  return output;
}

async function runCommand(
  executable: string,
  args: string[],
  cwd: string,
  environment: Record<string, string>,
  timeoutMs: number,
): Promise<string> {
  if (!ALLOWED_EXECUTABLES.has(executable)) throw new Error(`Unsupported local build executable: ${executable}`);
  return await new Promise((resolvePromise, reject) => {
    const child = spawn(executable, args, {
      cwd,
      env: { PATH: process.env.PATH ?? "", LANG: "C", LC_ALL: "C", TZ: "UTC", ...environment },
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    const append = (chunk: Uint8Array) => { output += Buffer.from(chunk).toString("utf8"); };
    child.stdout.on("data", append);
    child.stderr.on("data", append);
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`Build command exceeded ${timeoutMs}ms`));
    }, timeoutMs);
    child.once("error", (error) => { clearTimeout(timer); reject(error); });
    child.once("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolvePromise(output);
      else reject(new Error(`Build command failed with exit code ${code}: ${output}`));
    });
  });
}

async function git(args: string[], cwd?: string): Promise<string> {
  return await new Promise((resolvePromise, reject) => {
    const child = spawn("git", args, { cwd, shell: false, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk.toString(); });
    child.stderr.on("data", (chunk) => { output += chunk.toString(); });
    child.once("error", reject);
    child.once("close", (code) => code === 0
      ? resolvePromise(output.trim())
      : reject(new Error(`git ${args[0]} failed: ${output}`)));
  });
}

export async function runLocalBuild(input: {
  source: SourceRef;
  recipe: BuildRecipe;
  repositoryPath: string;
}): Promise<LocalBuildResult> {
  validateBuildRecipe(input.recipe);
  if (!/^[0-9a-f]{40}$/.test(input.source.commitSha)) throw new Error("A full immutable Git commit SHA is required");
  const temporaryRoot = await mkdtemp(join(tmpdir(), "proofrail-local-"));
  const checkout = join(temporaryRoot, "source");
  try {
    await git(["clone", "--quiet", "--no-checkout", "--", resolve(input.repositoryPath), checkout]);
    await git(["checkout", "--quiet", "--detach", input.source.commitSha], checkout);
    const actualCommit = await git(["rev-parse", "HEAD"], checkout);
    if (actualCommit !== input.source.commitSha) throw new Error("Checked-out commit does not match claim");
    const workingDirectory = safeResolve(checkout, input.recipe.workingDirectory || ".");
    const logs: string[] = [];
    for (const command of input.recipe.commands) {
      logs.push(await runCommand(
        command.executable,
        command.args,
        workingDirectory,
        input.recipe.environment,
        input.recipe.resourceLimits.timeoutMs,
      ));
    }
    const artifactPath = safeResolve(workingDirectory, input.recipe.artifactPath);
    const artifactStat = await stat(artifactPath);
    if (!artifactStat.isFile()) throw new Error("Build artifact is not a regular file");
    if (artifactStat.size > input.recipe.resourceLimits.maxOutputBytes) {
      throw new Error(`Build artifact exceeds ${input.recipe.resourceLimits.maxOutputBytes} bytes`);
    }
    return {
      artifactBytes: await readFile(artifactPath),
      environment: {
        runnerType: "local",
        runtime: input.recipe.runtime,
        sourceCommitSha: actualCommit,
        providerId: null,
        attestationAvailable: false,
        artifactDigestBoundToAttestation: false,
        evidenceReferences: [],
      },
      logs,
    };
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}
