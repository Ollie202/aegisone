import assert from "node:assert/strict";
import { test } from "node:test";
import { createVerification, recipeDigest } from "../../../packages/core/src/index.ts";
import type { BuildEnvironment, BuildRecipe, ReleaseClaim } from "../../../packages/core/src/index.ts";
import type { VerificationJob } from "../../../packages/job-store/src/index.ts";
import { renderJobHtml, renderProductHomeHtml } from "../src/product.ts";

const recipe: BuildRecipe = {
  version: "1",
  runtime: "node-22",
  workingDirectory: "examples/hello-proofrail",
  commands: [{ executable: "node", args: ["build.mjs"] }],
  artifactPath: "dist/hello-proofrail.json",
  networkPolicy: "none",
  resourceLimits: { timeoutMs: 60_000, maxOutputBytes: 1_024 },
  environment: {},
};
const claim: ReleaseClaim = {
  claimVersion: "1",
  projectId: "hello-proofrail@1",
  publisherIdentity: { type: "github", subject: "Ollie202", assuranceLevel: "DECLARED", evidenceReferences: [] },
  source: { provider: "git", repository: "https://github.com/Ollie202/proofrail-0g.git", commitSha: "e9c82277cef2f7630977e2473664e14eed2f860d" },
  recipeDigest: recipeDigest(recipe),
  artifactName: "hello-proofrail.json",
  claimAssuranceLevel: "DECLARED",
};
const environment: BuildEnvironment = {
  runnerType: "0g",
  runtime: "node-22",
  sourceCommitSha: claim.source.commitSha,
  providerId: "0xa19C4E672576E186AF81548E950Bf74A736220C3",
  attestationAvailable: true,
  artifactDigestBoundToAttestation: false,
  evidenceReferences: ["tdx:provider-only"],
};

function job(overrides: Partial<VerificationJob> = {}): VerificationJob {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    ownerId: null,
    createdAt: "2026-08-18T08:00:00.000Z",
    updatedAt: "2026-08-18T08:00:00.000Z",
    status: "queued",
    artifactKind: "software",
    projectId: claim.projectId,
    sourceRepository: claim.source.repository,
    sourceCommitSha: claim.source.commitSha,
    sourceSubdirectory: null,
    publisherArtifactName: claim.artifactName,
    publisherArtifactSha256: null,
    evidence: {
      manifestSha256: null,
      storageRoot: null,
      storageTransaction: null,
      registryContract: null,
      registryTransaction: null,
      registryRecordId: null,
    },
    verificationJson: null,
    failure: null,
    ...overrides,
  };
}

test("product home explains the mutable and immutable layers", () => {
  const html = renderProductHomeHtml();
  assert.match(html, /Supabase = app\/job memory/);
  assert.match(html, /0G Storage = canonical evidence/);
  assert.match(html, /cannot decide MATCH or MISMATCH/);
});

test("pipeline status cannot override a core MISMATCH verdict", () => {
  const verification = createVerification({
    claim,
    recipe,
    publisherBytes: new TextEncoder().encode("publisher"),
    reproducedBytes: new TextEncoder().encode("different"),
    environment,
  });
  const html = renderJobHtml(job({ status: "verified", verificationJson: verification }));
  assert.match(html, />MISMATCH</);
  assert.doesNotMatch(html, /class="badge match">MATCH/);
});

test("job page does not invent a correspondence verdict before evidence exists", () => {
  const html = renderJobHtml(job({ status: "running" }));
  assert.match(html, /Pipeline status: <strong>running<\/strong>/);
  assert.match(html, /No correspondence verdict is shown/);
  assert.doesNotMatch(html, />MATCH</);
});
