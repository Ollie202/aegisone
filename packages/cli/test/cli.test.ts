import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { canonicalJson } from "../../core/src/canonical.ts";
import { makeHelloAegisOneFixture } from "../../../examples/hello-aegisone/fixture.ts";
import { verifyLocalRelease } from "../src/verify.ts";

test("CLI service produces stable machine-readable verification JSON", async (context) => {
  const fixture = await makeHelloAegisOneFixture();
  context.after(fixture.cleanup);
  const artifactPath = join(fixture.repositoryPath, "publisher-artifact.json");
  await writeFile(artifactPath, fixture.publisherBytes);
  const result = await verifyLocalRelease({
    claim: fixture.claim,
    recipe: fixture.recipe,
    publisherArtifactPath: artifactPath,
    sourceRepositoryPath: fixture.repositoryPath,
  });
  const json = canonicalJson(result);
  const parsed = JSON.parse(json);
  assert.equal(parsed.schemaVersion, "1");
  assert.equal(parsed.sourceClaim.assuranceLevel, "DECLARED");
  assert.equal(parsed.correspondence.status, "MATCH");
  assert.equal(canonicalJson(parsed), json);
});
