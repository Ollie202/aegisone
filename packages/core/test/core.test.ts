import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canonicalBytes,
  canonicalJson,
  compareArtifacts,
  createVerification,
  recipeDigest,
  sha256Bytes,
  validateReleaseClaim,
} from "../src/index.ts";
import type { BuildEnvironment, BuildRecipe, ReleaseClaim } from "../src/index.ts";

const bytes = (value: string) => new TextEncoder().encode(value);

const recipe: BuildRecipe = {
  version: "1",
  runtime: "node-22",
  workingDirectory: ".",
  commands: [{ executable: "node", args: ["build.mjs"] }],
  artifactPath: "dist/artifact.json",
  networkPolicy: "none",
  resourceLimits: { timeoutMs: 1_000, maxOutputBytes: 1_024 },
  environment: {},
};
const claim: ReleaseClaim = {
  claimVersion: "1",
  projectId: "fixture@1",
  publisherIdentity: {
    type: "anonymous",
    subject: "fixture publisher",
    assuranceLevel: "DECLARED",
    evidenceReferences: [],
  },
  source: { provider: "git", repository: "fixture://repository", commitSha: "a".repeat(40) },
  recipeDigest: recipeDigest(recipe),
  artifactName: "artifact.json",
  claimAssuranceLevel: "DECLARED",
};
const environment: BuildEnvironment = {
  runnerType: "local",
  runtime: "node-22",
  sourceCommitSha: claim.source.commitSha,
  providerId: null,
  attestationAvailable: false,
  artifactDigestBoundToAttestation: false,
  evidenceReferences: [],
};

test("SHA-256 matches standard known vectors", () => {
  assert.equal(sha256Bytes(bytes("")), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  assert.equal(sha256Bytes(bytes("abc")), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("canonical JSON sorts object keys recursively and preserves array order", () => {
  assert.equal(canonicalJson({ z: 1, a: { y: 2, b: 3 }, list: [3, 2, 1] }),
    '{"a":{"b":3,"y":2},"list":[3,2,1],"z":1}');
  assert.deepEqual(canonicalBytes({ b: 2, a: 1 }), canonicalBytes({ a: 1, b: 2 }));
});

test("canonical JSON rejects ambiguous unsupported values", () => {
  assert.throws(() => canonicalJson({ missing: undefined }), /undefined/);
  assert.throws(() => canonicalJson({ value: Number.NaN }), /non-finite/);
  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  assert.throws(() => canonicalJson(cyclic), /cycles/);
});

test("comparison returns exact MATCH, deterministic MISMATCH, and insufficient evidence", () => {
  assert.equal(compareArtifacts(bytes("same"), bytes("same")).status, "MATCH");
  assert.equal(compareArtifacts(bytes("same"), bytes("samf")).status, "MISMATCH");
  assert.equal(compareArtifacts(bytes("same"), null).status, "INSUFFICIENT_EVIDENCE");
});

test("verification keeps source assurance separate from correspondence", () => {
  const result = createVerification({ claim, recipe, publisherBytes: bytes("same"), reproducedBytes: bytes("same"), environment });
  assert.equal(result.sourceClaim.assuranceLevel, "DECLARED");
  assert.equal(result.correspondence.status, "MATCH");
  assert.equal(result.manifest.environment.attestationAvailable, false);
  assert.equal(result.manifest.environment.artifactDigestBoundToAttestation, false);
});

test("canonical manifest and commitment are byte-stable", () => {
  const first = createVerification({ claim, recipe, publisherBytes: bytes("same"), reproducedBytes: bytes("same"), environment });
  const second = createVerification({ claim: structuredClone(claim), recipe: structuredClone(recipe), publisherBytes: bytes("same"), reproducedBytes: bytes("same"), environment: structuredClone(environment) });
  assert.equal(canonicalJson(first.manifest), canonicalJson(second.manifest));
  assert.equal(first.manifestSha256, second.manifestSha256);
});

test("invalid claims and recipe/commit substitutions fail closed", () => {
  assert.throws(() => validateReleaseClaim({ ...claim, source: { ...claim.source, commitSha: "main" } }), /full lowercase/);
  assert.throws(() => createVerification({ claim: { ...claim, recipeDigest: "0".repeat(64) }, recipe, publisherBytes: bytes("x"), reproducedBytes: bytes("x"), environment }), /recipeDigest/);
  assert.throws(() => createVerification({ claim, recipe, publisherBytes: bytes("x"), reproducedBytes: bytes("x"), environment: { ...environment, sourceCommitSha: "b".repeat(40) } }), /commit/);
});
