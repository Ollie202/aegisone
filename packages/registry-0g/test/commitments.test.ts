import assert from "node:assert/strict";
import test from "node:test";
import { canonicalBytes } from "../../core/src/canonical.ts";
import { sha256Bytes } from "../../core/src/hash.ts";
import type { VerificationJson } from "../../core/src/model.ts";
import { computeRegistryRecordId } from "../src/client.ts";
import {
  bytes32FromSha256,
  createRegistryCommitments,
  requireBytes32,
} from "../src/commitments.ts";

const sha = (pair: string) => pair.repeat(32);
const ROOT = `0x${sha("ab")}`;

const verification = {
  manifestSha256: sha("11"),
  artifacts: {
    publisher: { sha256: sha("22") },
    reproduced: { sha256: sha("33") },
  },
  manifest: {
    releaseClaim: {
      claimVersion: "1",
      projectId: "fixture",
      publisherIdentity: {
        type: "anonymous",
        subject: "fixture",
        assuranceLevel: "DECLARED",
        evidenceReferences: [],
      },
      source: {
        provider: "git",
        repository: "https://example.invalid/repo.git",
        commitSha: "0123456789abcdef0123456789abcdef01234567",
      },
      recipeDigest: sha("44"),
      artifactName: "fixture.txt",
      claimAssuranceLevel: "DECLARED",
    },
  },
} as unknown as VerificationJson;

test("registry commitments preserve AegisOne SHA-256 values as bytes32", () => {
  const commitments = createRegistryCommitments(verification, ROOT);
  assert.equal(commitments.manifestDigest, `0x${verification.manifestSha256}`);
  assert.equal(commitments.publisherArtifactDigest, `0x${verification.artifacts.publisher.sha256}`);
  assert.equal(commitments.reproducedArtifactDigest, `0x${verification.artifacts.reproduced.sha256}`);
  assert.equal(commitments.provenanceRoot, ROOT);

  const expectedSourceClaim = sha256Bytes(canonicalBytes(verification.manifest.releaseClaim));
  assert.equal(commitments.sourceClaimDigest, `0x${expectedSourceClaim}`);
});

test("record IDs are deterministic and bind all five commitments", () => {
  const commitments = createRegistryCommitments(verification, ROOT);
  const first = computeRegistryRecordId(commitments);
  const second = computeRegistryRecordId(commitments);
  assert.equal(first, second);

  const changed = { ...commitments, provenanceRoot: `0x${sha("cd")}` as const };
  assert.notEqual(computeRegistryRecordId(changed), first);
});

test("digest and bytes32 validation rejects malformed or zero commitments", () => {
  assert.throws(() => bytes32FromSha256("ABC"), /SHA-256/);
  assert.throws(() => requireBytes32("0x1234", "root"), /32-byte/);

  const commitments = createRegistryCommitments(verification, ROOT);
  assert.throws(
    () => computeRegistryRecordId({ ...commitments, manifestDigest: `0x${"0".repeat(64)}` }),
    /must not be zero/,
  );
});
