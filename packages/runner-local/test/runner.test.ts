import assert from "node:assert/strict";
import { test } from "node:test";
import { createVerification } from "../../core/src/verify.ts";
import { runLocalBuild } from "../src/run.ts";
import { makeFixture } from "./fixture.ts";

test("independent checkout of the exact fixture commit reproduces publisher bytes", async (context) => {
  const fixture = await makeFixture();
  context.after(fixture.cleanup);
  const build = await runLocalBuild({ source: fixture.claim.source, recipe: fixture.recipe, repositoryPath: fixture.repositoryPath });
  const result = createVerification({
    claim: fixture.claim,
    recipe: fixture.recipe,
    publisherBytes: fixture.publisherBytes,
    reproducedBytes: build.artifactBytes,
    environment: build.environment,
  });
  assert.equal(result.correspondence.status, "MATCH");
  assert.equal(result.artifacts.publisher.sha256, result.artifacts.reproduced.sha256);
  assert.equal(result.sourceClaim.commitSha, fixture.commitSha);
  assert.equal(fixture.commitSha, "85ce179a7487605112dd3e36129896082cc2cff0");
  assert.equal(result.manifest.environment.runnerType, "local");
});

test("one-byte publisher artifact substitution returns MISMATCH", async (context) => {
  const fixture = await makeFixture();
  context.after(fixture.cleanup);
  const build = await runLocalBuild({ source: fixture.claim.source, recipe: fixture.recipe, repositoryPath: fixture.repositoryPath });
  const mutated = Uint8Array.from(fixture.publisherBytes);
  mutated[mutated.length - 2] = mutated[mutated.length - 2] ^ 1;
  const result = createVerification({
    claim: fixture.claim,
    recipe: fixture.recipe,
    publisherBytes: mutated,
    reproducedBytes: build.artifactBytes,
    environment: build.environment,
  });
  assert.equal(result.correspondence.status, "MISMATCH");
  assert.notEqual(result.artifacts.publisher.sha256, result.artifacts.reproduced.sha256);
});

test("runner refuses a nonexistent or unpinned revision", async (context) => {
  const fixture = await makeFixture();
  context.after(fixture.cleanup);
  await assert.rejects(
    runLocalBuild({ source: { ...fixture.claim.source, commitSha: "f".repeat(40) }, recipe: fixture.recipe, repositoryPath: fixture.repositoryPath }),
    /git checkout failed/,
  );
  await assert.rejects(
    runLocalBuild({ source: { ...fixture.claim.source, commitSha: "main" }, recipe: fixture.recipe, repositoryPath: fixture.repositoryPath }),
    /full immutable/,
  );
});

test("runner enforces artifact output limit", async (context) => {
  const fixture = await makeFixture();
  context.after(fixture.cleanup);
  await assert.rejects(
    runLocalBuild({
      source: fixture.claim.source,
      recipe: { ...fixture.recipe, resourceLimits: { ...fixture.recipe.resourceLimits, maxOutputBytes: 1 } },
      repositoryPath: fixture.repositoryPath,
    }),
    /exceeds 1 bytes/,
  );
});
