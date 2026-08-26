import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import { test } from "node:test";
import { InMemoryCatalogStore } from "../../catalog-store/src/memory.ts";
import { authorizeVerificationTrigger } from "../src/authorization.ts";
import { runSkillVerificationEnrichment } from "../src/enrichment.ts";
import { toCorrespondenceEvidence, toSecurityAssessmentEvidence, toSourceInspectionEvidence } from "../src/capability-evidence.ts";
import { buildCapabilityVerificationInput } from "../src/verification-record.ts";
import { canonicalSkillPackageBytes } from "../../skill-audit/src/package.ts";
import { createFixtureGitRepository } from "./fixtures.ts";

/**
 * The M8.6 acceptance criterion "one bounded non-funded/local integration fixture proves
 * enrichment end-to-end before any live run". No 0G Sandbox/Storage/registry call happens
 * anywhere in this file, no network egress leaves the machine (the "distribution" is served by
 * a `127.0.0.1` HTTP server this test starts itself), and no secret/signer material is used —
 * this exercises the whole M8.6 linkage surface end-to-end against the local runner-equivalent
 * path only: exact-commit Git source acquisition, the existing deterministic Skill packager and
 * auditor, the existing `verifySkillPackages` correspondence comparison, the M8.1 capability
 * evidence mapping, and `capability_verifications` persistence via `InMemoryCatalogStore`.
 */

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

test("end-to-end: discovered resource version + source claim -> source-only inspection -> persisted linkage (no distribution yet)", async () => {
  const store = new InMemoryCatalogStore();
  const fixture = await createFixtureGitRepository();

  const authorization = authorizeVerificationTrigger("fixture-worker-token", sha256Hex("fixture-worker-token"), "integration-fixture");

  const resourceVersionId = "33333333-3333-4333-8333-333333333333";
  const sourceClaimId = "44444444-4444-4444-8444-444444444444";

  const result = await runSkillVerificationEnrichment({
    authorization,
    source: { repositoryUrl: fixture.repositoryPath, commitSha: fixture.commitSha, subdirectory: fixture.subdirectory },
    distribution: null,
    allowLocalFixtureRepository: true,
  });

  assert.equal(result.sourceInspection.status, "INSPECTED");
  assert.equal(result.correspondence.status, "NOT_EVALUATED");

  const stored = await store.createCapabilityVerification(buildCapabilityVerificationInput({
    resourceVersionId,
    sourceClaimId,
    verificationJobId: null,
    result,
  }));

  assert.equal(stored.sourceInspectionStatus, "INSPECTED");
  assert.equal(stored.correspondenceStatus, "NOT_EVALUATED");
  assert.equal(stored.publisherSha256, null);
  assert.equal(stored.canonicalEvidenceSha256, null);

  const latest = await store.getLatestCapabilityVerification(resourceVersionId);
  assert.equal(latest?.id, stored.id);

  // Independent capability-model dimensions, all derivable straight from the persisted row.
  const sourceInspectionEvidence = toSourceInspectionEvidence(result);
  const correspondenceEvidence = toCorrespondenceEvidence(result);
  const securityEvidence = toSecurityAssessmentEvidence(result);
  assert.equal(sourceInspectionEvidence.status, "INSPECTED");
  assert.equal(correspondenceEvidence.status, "NOT_EVALUATED");
  assert.equal(securityEvidence.status, "COMPLETED");
  assert.equal(securityEvidence.highestSeverity, "INFO");
});

test("end-to-end: adding a genuine local distribution artifact upgrades the same linkage to MATCH", async () => {
  const store = new InMemoryCatalogStore();
  const skillMarkdown = "---\nname: fixture-skill\ndescription: A deterministic fixture Agent Skill used only by skill-verification-link tests.\nlicense: MIT\n---\n\n# Fixture Skill\n\n1. Read the requested input.\n2. Return a deterministic fixture response.\n";
  const fixture = await createFixtureGitRepository(skillMarkdown);
  const genuineBytes = canonicalSkillPackageBytes([{ path: "SKILL.md", bytes: new TextEncoder().encode(skillMarkdown) }]);

  const server: Server = createServer((_request, response) => { response.end(Buffer.from(genuineBytes)); });
  await new Promise<void>((resolvePromise) => server.listen(0, "127.0.0.1", resolvePromise));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("failed to bind local fixture distribution server");

  try {
    const authorization = authorizeVerificationTrigger("fixture-worker-token", sha256Hex("fixture-worker-token"), "integration-fixture");
    const resourceVersionId = "33333333-3333-4333-8333-333333333333";

    const result = await runSkillVerificationEnrichment({
      authorization,
      source: { repositoryUrl: fixture.repositoryPath, commitSha: fixture.commitSha, subdirectory: fixture.subdirectory },
      distribution: { url: `https://127.0.0.1:${address.port}/fixture.skillpkg`, expectedSha256: null },
      allowLocalFixtureRepository: true,
      distributionFetchOptions: {
        allowPrivateNetworkForTesting: true,
        fetcher: async (input, init) => {
          const url = new URL(String(input));
          url.protocol = "http:";
          return fetch(url, init);
        },
      },
    });

    assert.equal(result.correspondence.status, "MATCH");

    const stored = await store.createCapabilityVerification(buildCapabilityVerificationInput({
      resourceVersionId,
      sourceClaimId: null,
      verificationJobId: null,
      result,
    }));
    assert.equal(stored.correspondenceStatus, "MATCH");
    assert.equal(stored.publisherSha256, stored.reproducedSha256);

    // A prior row (source-only, NOT_EVALUATED) for a different version stays untouched — this
    // insert never mutates history.
    const rows = await store.listCapabilityVerificationsByResourceVersion(resourceVersionId);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.correspondenceStatus, "MATCH");
  } finally {
    await new Promise<void>((resolvePromise) => server.close(() => resolvePromise()));
  }
});
