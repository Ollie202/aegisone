import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { buildCanonicalEvidenceManifest, buildEvidenceBundleBytes } from "../src/manifest.ts";
import { checkChainCommitment, checkStoragePublicationIntegrity, type PersistedPublication } from "../src/integrity.ts";
import { publishEvidenceBundle } from "../src/publish.ts";
import { parsePublishEvidenceRequest, MAX_PACKAGE_BYTES } from "../src/request.ts";
import type { EvidenceBundle, PublicationEvidenceFacts } from "../src/model.ts";
import type { StorageTransport, StorageUploadReceipt } from "../../storage-0g/src/types.ts";

/**
 * The whole publication path, exercised end to end against injected fakes.
 *
 * NOTHING here contacts 0G. Every root/transaction/record id below is an obviously synthetic test
 * value produced by the fake transport, never a real recorded one — a test fixture must never be
 * mistakable for live evidence. The genuine recorded M5/M7 values live in `hackathon/*.json` and
 * are surfaced only as the labelled historical runs they are.
 */

const NETWORK = { network: "0G Galileo Testnet", chainId: 16602 } as const;

const FACTS: PublicationEvidenceFacts = {
  artifactKind: "agent-skill",
  resourceVersionId: "version-under-test",
  sourceInspectionStatus: "INSPECTED",
  sourceSnapshotSha256: "a".repeat(64),
  correspondenceStatus: "MATCH",
  publisherSha256: "b".repeat(64),
  reproducedSha256: "b".repeat(64),
  securityStatus: "COMPLETED",
  securityHighestSeverity: "INFO",
  securityFindingCount: 0,
  verifiedAt: "2026-08-28T12:00:00.000Z",
};

const BUNDLE: EvidenceBundle = {
  facts: FACTS,
  packageBytes: new TextEncoder().encode("SKILL.md contents for the test package"),
  auditReport: { analysisKind: "DETERMINISTIC_STATIC", highestSeverity: "INFO", findings: [] },
};

/** Deterministic stand-in for 0G Storage. It derives its "root" from the bytes it is given, so the
 * round trip's exact-byte readback assertion is genuinely exercised rather than trivially passed. */
class FakeStorageTransport implements StorageTransport {
  readonly uploads: Uint8Array[] = [];
  #corruptDownload: boolean;

  constructor(options: { corruptDownload?: boolean } = {}) {
    this.#corruptDownload = options.corruptDownload ?? false;
  }

  async chainId(): Promise<number> {
    return 16602;
  }

  async upload(bytes: Uint8Array): Promise<StorageUploadReceipt> {
    this.uploads.push(bytes);
    const root = `0x${createHash("sha256").update(bytes).digest("hex")}`;
    return {
      rootHashes: [root],
      transactionHashes: [`0x${createHash("sha256").update("tx").update(bytes).digest("hex")}`],
      transactionSequences: [1],
      locallyCalculatedRootHash: root,
    };
  }

  async download(rootHashes: string[], options: { proof: true }): Promise<Uint8Array> {
    assert.equal(options.proof, true, "the publish path must always request a proof-verified download");
    const stored = this.uploads.at(-1)!;
    if (this.#corruptDownload) {
      const corrupted = Uint8Array.from(stored);
      corrupted[0] = (corrupted[0]! + 1) % 256;
      return corrupted;
    }
    return stored;
  }
}

test("publishing uploads the bundle, binds the root into the manifest digest, and commits on chain", async () => {
  const storage = new FakeStorageTransport();
  const registered: Array<{ manifestDigest: string; provenanceRoot: string }> = [];

  const result = await publishEvidenceBundle(BUNDLE, {
    storage,
    network: NETWORK,
    registry: {
      async register(manifestDigest, provenanceRoot) {
        registered.push({ manifestDigest, provenanceRoot });
        return {
          recordId: `0x${createHash("sha256").update(manifestDigest).update(provenanceRoot).digest("hex")}`,
          transactionHash: `0x${"1".repeat(64)}`,
          contractAddress: "0x227Fcc243f25c395C93Df789EC72Bc75bf096017",
        };
      },
    },
  });

  // The bytes actually uploaded are the canonical bundle, containing the exact package bytes.
  assert.equal(storage.uploads.length, 1);
  assert.deepEqual(storage.uploads[0], buildEvidenceBundleBytes(BUNDLE));

  // The manifest digest is the one built over the facts PLUS the returned root.
  const expected = buildCanonicalEvidenceManifest(FACTS, result.storage);
  assert.equal(result.canonicalEvidenceSha256, expected.sha256);

  // The chain commitment carries exactly the two digests, nothing else.
  assert.deepEqual(registered, [{ manifestDigest: expected.sha256, provenanceRoot: result.storage.root }]);
  assert.equal(result.registryError, null);
  assert.equal(result.registry?.contract, "0x227Fcc243f25c395C93Df789EC72Bc75bf096017");
});

test("a storage readback that is not byte-identical aborts the publication with no root returned", async () => {
  const storage = new FakeStorageTransport({ corruptDownload: true });
  await assert.rejects(
    () => publishEvidenceBundle(BUNDLE, { storage, network: NETWORK, registry: null }),
    /BYTE_MISMATCH|do not exactly match/,
  );
});

test("a failed chain commitment never discards the real storage evidence", async () => {
  const storage = new FakeStorageTransport();
  const result = await publishEvidenceBundle(BUNDLE, {
    storage,
    network: NETWORK,
    registry: {
      async register() {
        throw new Error("registry RPC unavailable");
      },
    },
  });
  assert.match(result.storage.root, /^0x[0-9a-f]{64}$/);
  assert.equal(result.registry, null);
  assert.match(result.registryError ?? "", /registry RPC unavailable/);
});

test("storage-only publication performs no chain write at all", async () => {
  const storage = new FakeStorageTransport();
  const result = await publishEvidenceBundle(BUNDLE, { storage, network: NETWORK, registry: null });
  assert.equal(result.registry, null);
  assert.equal(result.registryError, null);
});

/** Builds the `capability_verifications`-shaped row a real publication would persist. */
function rowFromPublication(result: Awaited<ReturnType<typeof publishEvidenceBundle>>): PersistedPublication {
  return {
    artifactKind: "agent-skill",
    resourceVersionId: FACTS.resourceVersionId,
    sourceInspectionStatus: FACTS.sourceInspectionStatus,
    sourceSnapshotSha256: FACTS.sourceSnapshotSha256,
    correspondenceStatus: FACTS.correspondenceStatus,
    publisherSha256: FACTS.publisherSha256,
    reproducedSha256: FACTS.reproducedSha256,
    securityStatus: FACTS.securityStatus,
    securityHighestSeverity: FACTS.securityHighestSeverity,
    securityFindingCount: FACTS.securityFindingCount,
    canonicalEvidenceSha256: result.canonicalEvidenceSha256,
    storageRoot: result.storage.root,
    storageTransaction: result.storage.transaction,
    registryContract: result.registry?.contract ?? null,
    registryRecordId: result.registry?.recordId ?? null,
    registryTransaction: result.registry?.transaction ?? null,
    verifiedAt: FACTS.verifiedAt,
  };
}

async function genuinePublication() {
  const result = await publishEvidenceBundle(BUNDLE, {
    storage: new FakeStorageTransport(),
    network: NETWORK,
    registry: {
      async register(manifestDigest, provenanceRoot) {
        return {
          recordId: `0x${createHash("sha256").update(manifestDigest).update(provenanceRoot).digest("hex")}`,
          transactionHash: `0x${"1".repeat(64)}`,
          contractAddress: "0x227Fcc243f25c395C93Df789EC72Bc75bf096017",
        };
      },
    },
  });
  return { result, row: rowFromPublication(result) };
}

test("a genuine publication passes the integrity gate", async () => {
  const { row } = await genuinePublication();
  const integrity = checkStoragePublicationIntegrity(row, NETWORK);
  assert.equal(integrity.ok, true);
});

test("an absent publication is reported as absent, not as a failure", () => {
  const empty: PersistedPublication = {
    ...( { } as never),
    artifactKind: "agent-skill",
    resourceVersionId: "v",
    sourceInspectionStatus: "NOT_RUN",
    sourceSnapshotSha256: null,
    correspondenceStatus: "NOT_EVALUATED",
    publisherSha256: null,
    reproducedSha256: null,
    securityStatus: "NOT_RUN",
    securityHighestSeverity: null,
    securityFindingCount: null,
    canonicalEvidenceSha256: null,
    storageRoot: null,
    storageTransaction: null,
    registryContract: null,
    registryRecordId: null,
    registryTransaction: null,
    verifiedAt: null,
  };
  const integrity = checkStoragePublicationIntegrity(empty, NETWORK);
  assert.equal(integrity.ok, false);
  assert.equal(integrity.ok === false && integrity.reason, "NO_PUBLICATION_RECORDED");
});

/**
 * THE core regression of this PR. Each mutation is what a compromised/mutated Supabase row would
 * look like (docs/17 Threat M8-012). None of them may pass the gate.
 */
test("no single-field row mutation can produce a passing storage publication", async () => {
  const { row } = await genuinePublication();

  const mutations: Array<[string, PersistedPublication]> = [
    // A wholly fabricated root, the headline attack: claim 0G storage that never happened.
    ["fabricated storage root", { ...row, storageRoot: `0x${"f".repeat(64)}` }],
    ["zero storage root", { ...row, storageRoot: `0x${"0".repeat(64)}` }],
    ["malformed storage root", { ...row, storageRoot: "not-a-root" }],
    ["fabricated storage transaction", { ...row, storageTransaction: `0x${"e".repeat(64)}` }],
    // Upgrading the verdict after the fact.
    ["correspondence upgraded to MATCH", { ...row, correspondenceStatus: "MATCH", publisherSha256: "c".repeat(64) }],
    ["correspondence downgraded", { ...row, correspondenceStatus: "MISMATCH" }],
    ["publisher digest swapped", { ...row, publisherSha256: "d".repeat(64) }],
    ["reproduced digest swapped", { ...row, reproducedSha256: "d".repeat(64) }],
    // Laundering an audit result.
    // The genuine row records INFO / 0 findings, so a laundering attempt has to *change* the
    // recorded severity in either direction to be a real mutation.
    ["severity raised", { ...row, securityHighestSeverity: "CRITICAL" }],
    ["severity nulled", { ...row, securityHighestSeverity: null }],
    ["finding count altered", { ...row, securityFindingCount: 99 }],
    ["security status altered", { ...row, securityStatus: "NOT_RUN" }],
    // Re-dating a publication to look fresh.
    ["verifiedAt moved", { ...row, verifiedAt: "2027-01-01T00:00:00.000Z" }],
    // Pointing the evidence at another version.
    ["resource version swapped", { ...row, resourceVersionId: "some-other-version" }],
    ["source snapshot swapped", { ...row, sourceSnapshotSha256: "e".repeat(64) }],
    ["source inspection upgraded", { ...row, sourceInspectionStatus: "INSPECTED", sourceSnapshotSha256: null }],
    // Substituting the digest itself.
    ["canonical digest replaced", { ...row, canonicalEvidenceSha256: "f".repeat(64) }],
    ["canonical digest removed", { ...row, canonicalEvidenceSha256: null }],
    ["verifiedAt removed", { ...row, verifiedAt: null }],
  ];

  for (const [name, mutated] of mutations) {
    const integrity = checkStoragePublicationIntegrity(mutated, NETWORK);
    assert.equal(integrity.ok, false, `mutation "${name}" must not produce a passing storage publication`);
  }
});

test("a root from one publication cannot be paired with the evidence of another", async () => {
  const first = await genuinePublication();
  const second = await publishEvidenceBundle(
    { ...BUNDLE, facts: { ...FACTS, resourceVersionId: "a-different-version" } },
    { storage: new FakeStorageTransport(), network: NETWORK, registry: null },
  );

  // Splicing the second publication's root onto the first publication's row.
  const spliced: PersistedPublication = { ...first.row, storageRoot: second.storage.root };
  const integrity = checkStoragePublicationIntegrity(spliced, NETWORK);
  assert.equal(integrity.ok, false);
  assert.equal(integrity.ok === false && integrity.reason, "MANIFEST_DIGEST_MISMATCH");
});

test("a publication recorded against one network does not validate as another", async () => {
  const { row } = await genuinePublication();
  const integrity = checkStoragePublicationIntegrity(row, { network: "0G Aristotle Mainnet", chainId: 16661 });
  assert.equal(integrity.ok, false, "a Galileo publication must not present as a mainnet one");
});

test("the chain commitment is a separate fact and a forged record id is rejected", async () => {
  const { row } = await genuinePublication();
  const storage = checkStoragePublicationIntegrity(row, NETWORK);
  assert.equal(storage.ok, true);
  if (!storage.ok) return;

  const recompute = (provenanceRoot: string, manifestDigest: string) =>
    `0x${createHash("sha256").update(manifestDigest).update(provenanceRoot).digest("hex")}`;

  assert.equal(checkChainCommitment(row, storage, recompute).ok, true);

  const forged = { ...row, registryRecordId: `0x${"9".repeat(64)}` };
  assert.equal(checkChainCommitment(forged, storage, recompute).ok, false);

  // Storage-only: absent commitment, but the storage fact itself is untouched.
  const storageOnly = { ...row, registryContract: null, registryRecordId: null, registryTransaction: null };
  assert.equal(checkChainCommitment(storageOnly, storage, recompute).ok, false);
  assert.equal(checkStoragePublicationIntegrity(storageOnly, NETWORK).ok, true);
});

/** Request validation: the worker must never accept anything but a bounded evidence bundle. */

function validRequestBody(): Record<string, unknown> {
  return {
    resourceVersionId: "version-under-test",
    artifactKind: "agent-skill",
    facts: {
      sourceInspectionStatus: "INSPECTED",
      sourceSnapshotSha256: "a".repeat(64),
      correspondenceStatus: "MATCH",
      publisherSha256: "b".repeat(64),
      reproducedSha256: "b".repeat(64),
      securityStatus: "COMPLETED",
      securityHighestSeverity: "INFO",
      securityFindingCount: 0,
      verifiedAt: "2026-08-28T12:00:00.000Z",
    },
    packageBase64: Buffer.from("SKILL.md").toString("base64"),
    auditReport: { highestSeverity: "INFO", findings: [] },
  };
}

test("a well-formed publish request parses into the expected bundle", () => {
  const { bundle } = parsePublishEvidenceRequest(validRequestBody());
  assert.equal(bundle.facts.correspondenceStatus, "MATCH");
  assert.deepEqual(Buffer.from(bundle.packageBytes).toString("utf8"), "SKILL.md");
});

test("the publish request rejects anything outside its bounded shape", () => {
  const cases: Array<[string, unknown]> = [
    ["non-object body", "just a string"],
    ["unknown top-level field", { ...validRequestBody(), bytesToSign: "0xdeadbeef" }],
    ["unknown facts field", { ...validRequestBody(), facts: { ...(validRequestBody().facts as object), toAddress: "0xabc" } }],
    ["unsupported artifact kind", { ...validRequestBody(), artifactKind: "container-image" }],
    ["bad correspondence status", { ...validRequestBody(), facts: { ...(validRequestBody().facts as object), correspondenceStatus: "TOTALLY_FINE" } }],
    ["MATCH without both digests", { ...validRequestBody(), facts: { ...(validRequestBody().facts as object), reproducedSha256: null } }],
    ["bad severity", { ...validRequestBody(), facts: { ...(validRequestBody().facts as object), securityHighestSeverity: "APOCALYPTIC" } }],
    ["bad timestamp", { ...validRequestBody(), facts: { ...(validRequestBody().facts as object), verifiedAt: "whenever" } }],
    ["non-base64 package", { ...validRequestBody(), packageBase64: "not valid base64!!" }],
    ["empty package", { ...validRequestBody(), packageBase64: "" }],
    ["missing audit report", (() => { const body = validRequestBody(); delete body.auditReport; return body; })()],
    ["oversized package", { ...validRequestBody(), packageBase64: Buffer.alloc(MAX_PACKAGE_BYTES + 1, 0x41).toString("base64") }],
  ];

  for (const [name, body] of cases) {
    assert.throws(() => parsePublishEvidenceRequest(body), /PublishRequestError|Error/, `"${name}" must be rejected`);
  }
});

test("the publish request has no field through which arbitrary bytes could be signed", () => {
  // A structural assertion of the security property, not a behavioural one: the accepted key set
  // is closed, and none of its members is a signable/executable/destination value.
  for (const forbidden of ["bytesToSign", "message", "calldata", "to", "value", "command", "url", "contract", "privateKey"]) {
    assert.throws(
      () => parsePublishEvidenceRequest({ ...validRequestBody(), [forbidden]: "0x00" }),
      /unexpected field/,
      `'${forbidden}' must be rejected as an unexpected field`,
    );
  }
});
