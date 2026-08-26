import assert from "node:assert/strict";
import { test } from "node:test";
import { createVerification, createVerificationView, recipeDigest } from "../src/index.ts";
import type { BuildEnvironment, BuildRecipe, ReleaseClaim } from "../src/index.ts";

const bytes = (value: string) => new TextEncoder().encode(value);
const recipe: BuildRecipe = {
  version: "1",
  runtime: "node-22",
  workingDirectory: ".",
  commands: [{ executable: "node", args: ["build.mjs"] }],
  artifactPath: "dist/artifact.json",
  networkPolicy: "none",
  resourceLimits: { timeoutMs: 60_000, maxOutputBytes: 1_024 },
  environment: {},
};
const claim: ReleaseClaim = {
  claimVersion: "1",
  projectId: "hello-aegisone@1",
  publisherIdentity: {
    type: "github",
    subject: "Ollie202/aegisone",
    assuranceLevel: "DECLARED",
    evidenceReferences: ["https://github.com/Ollie202/aegisone"],
  },
  source: {
    provider: "git",
    repository: "https://github.com/Ollie202/aegisone.git",
    commitSha: "e9c82277cef2f7630977e2473664e14eed2f860d",
  },
  recipeDigest: recipeDigest(recipe),
  artifactName: "artifact.json",
  claimAssuranceLevel: "DECLARED",
};
const environment: BuildEnvironment = {
  runnerType: "0g",
  runtime: "node-22",
  sourceCommitSha: claim.source.commitSha,
  providerId: "0xa19C4E672576E186AF81548E950Bf74A736220C3",
  attestationAvailable: true,
  artifactDigestBoundToAttestation: false,
  evidenceReferences: ["tdx:provider-evidence"],
};

test("judgeable view derives MATCH and the precise live 0G attestation boundary from core evidence", () => {
  const verification = createVerification({ claim, recipe, publisherBytes: bytes("same"), reproducedBytes: bytes("same"), environment });
  const view = createVerificationView(verification);
  assert.equal(view.verdict, "MATCH");
  assert.equal(view.build.independent0gRebuild, true);
  assert.equal(view.build.attestation, "PROVIDER_EVIDENCE_ONLY");
  assert.match(view.warnings.join(" "), /not bound/);
});

test("judgeable view reports substituted publisher bytes as MISMATCH", () => {
  const verification = createVerification({ claim, recipe, publisherBytes: bytes("tampered"), reproducedBytes: bytes("same"), environment });
  assert.equal(createVerificationView(verification).verdict, "MISMATCH");
});

test("judgeable view rejects a display-layer attempt to change the core verdict", () => {
  const verification = createVerification({ claim, recipe, publisherBytes: bytes("same"), reproducedBytes: bytes("same"), environment });
  const tampered = structuredClone(verification);
  tampered.correspondence = { ...tampered.correspondence, status: "MISMATCH" };
  assert.throws(() => createVerificationView(tampered), /correspondence result/);
});
