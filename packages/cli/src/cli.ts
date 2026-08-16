#!/usr/bin/env -S node --experimental-strip-types
import { readFile } from "node:fs/promises";
import type { BuildRecipe, ReleaseClaim } from "../../core/src/model.ts";
import { canonicalJson } from "../../core/src/canonical.ts";
import { verifyLocalRelease } from "./verify.ts";

function valueAfter(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index === -1 ? undefined : process.argv[index + 1];
  if (!value) throw new Error(`Missing required ${name}`);
  return value;
}

async function main(): Promise<void> {
  if (process.argv[2] !== "verify") {
    throw new Error("Usage: proofrail verify --claim claim.json --recipe recipe.json --artifact release.bin --source-repository path --json");
  }
  if (!process.argv.includes("--json")) throw new Error("M1 CLI currently requires --json");
  const claim = JSON.parse(await readFile(valueAfter("--claim"), "utf8")) as ReleaseClaim;
  const recipe = JSON.parse(await readFile(valueAfter("--recipe"), "utf8")) as BuildRecipe;
  const result = await verifyLocalRelease({
    claim,
    recipe,
    publisherArtifactPath: valueAfter("--artifact"),
    sourceRepositoryPath: valueAfter("--source-repository"),
  });
  process.stdout.write(canonicalJson(result) + "\n");
  process.exitCode = result.correspondence.status === "MATCH" ? 0 : 1;
}

main().catch((error: unknown) => {
  process.stderr.write(JSON.stringify({ schemaVersion: "1", error: error instanceof Error ? error.message : String(error) }) + "\n");
  process.exitCode = 2;
});
