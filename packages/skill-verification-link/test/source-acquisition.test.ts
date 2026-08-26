import assert from "node:assert/strict";
import { test } from "node:test";
import { auditSourceInspection, inspectSourceOnly, SourceAcquisitionError } from "../src/source-acquisition.ts";
import { createFixtureGitRepository } from "./fixtures.ts";

test("inspects a genuine exact-commit source checkout and never touches correspondence", async () => {
  const fixture = await createFixtureGitRepository();
  const outcome = await inspectSourceOnly(
    { repositoryUrl: fixture.repositoryPath, commitSha: fixture.commitSha, subdirectory: fixture.subdirectory },
    { allowLocalFixtureRepository: true },
  );
  assert.equal(outcome.status, "INSPECTED");
  assert.equal(outcome.exactCommitSha, fixture.commitSha.toLowerCase());
  assert.equal(outcome.directoryName, "fixture-skill");
  assert.ok(/^[0-9a-f]{64}$/.test(outcome.sourceSnapshotSha256));
  assert.equal(outcome.format.valid, true);
  // Structural: SourceInspectionOutcome carries no "correspondence"/"publisher" field at all.
  assert.equal("correspondence" in outcome, false);
  assert.equal("publisherSha256" in outcome, false);
});

test("the deterministic audit runs cleanly against a clean source-only package", async () => {
  const fixture = await createFixtureGitRepository();
  const outcome = await inspectSourceOnly(
    { repositoryUrl: fixture.repositoryPath, commitSha: fixture.commitSha, subdirectory: fixture.subdirectory },
    { allowLocalFixtureRepository: true },
  );
  const audit = auditSourceInspection(outcome);
  assert.equal(audit.highestSeverity, "INFO");
  assert.equal(audit.findingCount, 0);
});

test("rejects a non-full/short/uppercase commit SHA", async () => {
  const fixture = await createFixtureGitRepository();
  await assert.rejects(
    inspectSourceOnly(
      { repositoryUrl: fixture.repositoryPath, commitSha: fixture.commitSha.slice(0, 7), subdirectory: fixture.subdirectory },
      { allowLocalFixtureRepository: true },
    ),
    SourceAcquisitionError,
  );
});

test("rejects a commit that does not exist in the repository (fails closed rather than silently checking out HEAD)", async () => {
  const fixture = await createFixtureGitRepository();
  const fakeButWellFormedSha = "0".repeat(40);
  await assert.rejects(
    inspectSourceOnly(
      { repositoryUrl: fixture.repositoryPath, commitSha: fakeButWellFormedSha, subdirectory: fixture.subdirectory },
      { allowLocalFixtureRepository: true },
    ),
  );
});

test("rejects a path-traversal subdirectory", async () => {
  const fixture = await createFixtureGitRepository();
  await assert.rejects(
    inspectSourceOnly(
      { repositoryUrl: fixture.repositoryPath, commitSha: fixture.commitSha, subdirectory: "../../etc" },
      { allowLocalFixtureRepository: true },
    ),
    SourceAcquisitionError,
  );
});

test("rejects a non-GitHub-HTTPS repository URL in production mode (no local-fixture escape hatch)", async () => {
  const fixture = await createFixtureGitRepository();
  await assert.rejects(
    inspectSourceOnly({ repositoryUrl: fixture.repositoryPath, commitSha: fixture.commitSha, subdirectory: fixture.subdirectory }),
    SourceAcquisitionError,
  );
});

