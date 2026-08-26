import assert from "node:assert/strict";
import { test } from "node:test";
import { createVerification, recipeDigest } from "../../../packages/core/src/index.ts";
import type { BuildEnvironment, BuildRecipe, ReleaseClaim } from "../../../packages/core/src/index.ts";
import { renderVerificationHtml } from "../src/render.ts";

const recipe: BuildRecipe = {
  version: "1",
  runtime: "node-22",
  workingDirectory: "examples/hello-aegisone",
  commands: [{ executable: "node", args: ["build.mjs"] }],
  artifactPath: "dist/hello-aegisone.json",
  networkPolicy: "none",
  resourceLimits: { timeoutMs: 60_000, maxOutputBytes: 1_024 },
  environment: {},
};
const claim: ReleaseClaim = {
  claimVersion: "1",
  projectId: "hello-aegisone@1",
  publisherIdentity: { type: "github", subject: "Ollie202", assuranceLevel: "DECLARED", evidenceReferences: [] },
  source: { provider: "git", repository: "https://github.com/Ollie202/aegisone.git", commitSha: "e9c82277cef2f7630977e2473664e14eed2f860d" },
  recipeDigest: recipeDigest(recipe),
  artifactName: "hello-aegisone.json",
  claimAssuranceLevel: "DECLARED",
};
const environment: BuildEnvironment = {
  runnerType: "0g",
  runtime: "node-22",
  sourceCommitSha: claim.source.commitSha,
  providerId: "0xa19C4E672576E186AF81548E950Bf74A736220C3",
  attestationAvailable: true,
  artifactDigestBoundToAttestation: false,
  evidenceReferences: ["tdx:real-provider-evidence"],
};

test("web viewer renders the same core MATCH plus precise TEE limitation", () => {
  const evidence = createVerification({ claim, recipe, publisherBytes: new TextEncoder().encode("same"), reproducedBytes: new TextEncoder().encode("same"), environment });
  const html = renderVerificationHtml(evidence);
  assert.match(html, />MATCH</);
  assert.match(html, /0G Sandbox/);
  assert.match(html, /PROVIDER_EVIDENCE_ONLY/);
  assert.match(html, /not bound to that attestation/);
  assert.match(html, new RegExp(claim.source.commitSha));
});

test("web viewer cannot turn a core MISMATCH into MATCH", () => {
  const evidence = createVerification({ claim, recipe, publisherBytes: new TextEncoder().encode("publisher"), reproducedBytes: new TextEncoder().encode("substituted"), environment });
  const html = renderVerificationHtml(evidence);
  assert.match(html, />MISMATCH</);
  assert.doesNotMatch(html, /class="badge match">MATCH/);
});
