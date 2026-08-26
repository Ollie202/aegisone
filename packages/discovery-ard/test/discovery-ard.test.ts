import assert from "node:assert/strict";
import { test } from "node:test";
import type { CapabilityResource, TrustPolicy } from "../../capability-model/src/model.ts";
import { evaluateTrustPolicy } from "../../capability-model/src/policy.ts";
import {
  ARD_MAX_PAGE_SIZE,
  ARD_MEDIA_TYPES,
  ARD_SPEC_COMMIT,
  ARD_UPSTREAM_FILES,
  AEGISONE_ARD_METADATA,
  ardEntryToCapabilityResource,
  assertValidArdCatalogManifest,
  assertValidArdEntry,
  capabilityResourceToArdEntry,
  createLocalCatalog,
  createAegisOneArdCatalogManifest,
  parseArdSearchRequest,
  pinnedArdRawUrl,
  searchLocalCatalog,
} from "../src/index.ts";

const SHA_A = "a".repeat(64);
const SHA_B = "b".repeat(64);
const COMMIT = "c".repeat(40);

function verifiedResource(): CapabilityResource {
  const resource = structuredClone(createLocalCatalog()[0]!.resource);
  resource.currentVersion = {
    id: `${resource.id}@verified`,
    versionLabel: "2.0.0",
    source: {
      repositoryUrl: "https://github.com/example/reviewer",
      commitSha: COMMIT,
      subdirectory: "skill",
    },
    distribution: {
      url: "https://example.test/reviewer.skill",
      sha256: SHA_A,
    },
  };
  resource.trust = {
    sourceAssurance: { level: "REPOSITORY_AUTHENTICATED", evidenceRefs: ["github:example/reviewer"] },
    sourceInspection: { status: "INSPECTED", exactCommitSha: COMMIT, sourceSnapshotSha256: SHA_B },
    correspondence: { status: "MATCH", publisherSha256: SHA_A, reproducedSha256: SHA_A },
    security: { status: "COMPLETED", analysisKind: "DETERMINISTIC_STATIC", highestSeverity: "INFO", findingCount: 0 },
    canonicalEvidence: {
      status: "AVAILABLE",
      sha256: SHA_B,
      verifiedAt: "2026-08-24T12:00:00.000Z",
      storageRoot: "0xproof",
      registryRecordId: "0xrecord",
    },
  };
  return resource;
}

test("records the immutable ARD v0.9 specification and schema provenance", () => {
  assert.equal(ARD_SPEC_COMMIT, "1d25abcf07e081f604dba3ae5398b16c79f20b7b");
  assert.deepEqual(ARD_UPSTREAM_FILES, {
    specification: { path: "spec/ard.md", gitBlobSha: "153a01c922ddb75f9d0d3b4abdfb74579abc97d9" },
    catalogSchema: { path: "spec/schemas/ai-catalog.schema.json", gitBlobSha: "37c4cb743b29741847e6f99f8bc8ccaaa2d6e422" },
    entrySchema: { path: "spec/schemas/ard-entry.schema.json", gitBlobSha: "f06cfec015c248e6994d0aa53ce8a03e27ad80e4" },
    openApi: { path: "spec/schemas/ard.openapi.yaml", gitBlobSha: "925af8cb8cbb86a9ecd72763bf70d33b4233004b" },
  });
  assert.equal(
    pinnedArdRawUrl(ARD_UPSTREAM_FILES.catalogSchema.path),
    `https://raw.githubusercontent.com/ards-project/ard-spec/${ARD_SPEC_COMMIT}/spec/schemas/ai-catalog.schema.json`,
  );
});

test("catalog generator advertises the bounded AegisOne search endpoint", () => {
  const manifest = createAegisOneArdCatalogManifest("https://aegisone.example/");
  assert.doesNotThrow(() => assertValidArdCatalogManifest(manifest));
  assert.equal(manifest.specVersion, "1.0");
  assert.equal(manifest.entries.length, 1);
  assert.equal(manifest.entries[0]!.type, ARD_MEDIA_TYPES.registry);
  assert.equal(manifest.entries[0]!.url, "https://aegisone.example/search");
  assert.equal(manifest.entries[0]!.metadata?.[AEGISONE_ARD_METADATA.ardSpecCommit], ARD_SPEC_COMMIT);
  assert.equal(manifest.entries[0]!.trustManifest, undefined);
});

test("maps all four provider-independent resource kinds to the pinned ARD media types", () => {
  const entries = createLocalCatalog().map((record) => record.entry);
  assert.deepEqual(entries.map((entry) => entry.type), [
    ARD_MEDIA_TYPES.agentSkill,
    ARD_MEDIA_TYPES.mcpServer,
    ARD_MEDIA_TYPES.a2aAgent,
    ARD_MEDIA_TYPES.api,
  ]);
  for (const entry of entries) assert.doesNotThrow(() => assertValidArdEntry(entry));
});

test("enforces strict ARD value-or-reference semantics", () => {
  const resource = createLocalCatalog()[0]!.resource;
  const embedded = capabilityResourceToArdEntry(resource, { content: { data: { name: "inline skill" } } });
  assert.deepEqual(embedded.data, { name: "inline skill" });
  assert.equal(embedded.url, undefined);

  const both = { ...embedded, url: "https://example.test/skill" };
  assert.throws(() => assertValidArdEntry(both), /exactly one of url or data/);
  const neither = { ...embedded };
  delete neither.data;
  assert.throws(() => assertValidArdEntry(neither), /exactly one of url or data/);
  assert.throws(() => assertValidArdEntry({ ...embedded, metadata: [] } as never), /metadata must be a JSON object/);
});

test("emits namespaced evidence state only from a valid CapabilityResource", () => {
  const resource = verifiedResource();
  const entry = capabilityResourceToArdEntry(resource);
  assert.equal(entry.metadata?.[AEGISONE_ARD_METADATA.sourceAssurance], "REPOSITORY_AUTHENTICATED");
  assert.equal(entry.metadata?.[AEGISONE_ARD_METADATA.correspondence], "MATCH");
  assert.equal(entry.metadata?.[AEGISONE_ARD_METADATA.securityAssessment], "COMPLETED");
  assert.equal(entry.metadata?.[AEGISONE_ARD_METADATA.canonicalEvidence], "AVAILABLE");
  assert.equal("verified" in (entry.metadata ?? {}), false);

  resource.trust.correspondence.reproducedSha256 = SHA_B;
  assert.throws(() => capabilityResourceToArdEntry(resource), /MATCH requires identical/);
});

test("ARD trustManifest and trust-looking metadata cannot upgrade AegisOne evidence", () => {
  const entry = structuredClone(createLocalCatalog()[0]!.entry);
  entry.trustManifest = {
    identity: "did:web:attacker.example",
    verified: true,
    attestations: [{ type: "claims-everything", uri: "https://attacker.example/claim" }],
  };
  entry.metadata = {
    ...(entry.metadata ?? {}),
    verified: true,
    [AEGISONE_ARD_METADATA.sourceAssurance]: "SIGNED_RELEASE",
    [AEGISONE_ARD_METADATA.correspondence]: "MATCH",
    [AEGISONE_ARD_METADATA.canonicalEvidence]: "AVAILABLE",
  };

  const resource = ardEntryToCapabilityResource(entry, {
    source: "https://registry.example/search",
    discoveredAt: "2026-08-24T18:00:00.000Z",
  });
  assert.equal(resource.discovery.status, "INDEXED");
  assert.equal(resource.trust.sourceAssurance.level, "NONE");
  assert.equal(resource.trust.sourceInspection.status, "NOT_RUN");
  assert.equal(resource.trust.correspondence.status, "NOT_EVALUATED");
  assert.equal(resource.trust.security.status, "NOT_RUN");
  assert.equal(resource.trust.canonicalEvidence.status, "NONE");
});

test("search relevance round-trip remains discovery-only and cannot change policy", () => {
  const entry = createLocalCatalog()[0]!.entry;
  const high = ardEntryToCapabilityResource({ ...entry, score: 100, source: "https://registry.example/search" }, {
    source: "https://registry.example/search",
    discoveredAt: "2026-08-24T18:00:00.000Z",
  });
  const low = ardEntryToCapabilityResource({ ...entry, score: 1, source: "https://registry.example/search" }, {
    source: "https://registry.example/search",
    discoveredAt: "2026-08-24T18:00:00.000Z",
  });
  const policy: TrustPolicy = {
    schemaVersion: "1",
    requireCorrespondence: "MATCH",
    missingEvidenceDecision: "DENY",
  };
  assert.equal(high.discovery.relevanceScore, 1);
  assert.equal(low.discovery.relevanceScore, 0.01);
  assert.deepEqual(evaluateTrustPolicy(high, policy, Date.now()), evaluateTrustPolicy(low, policy, Date.now()));
  assert.equal(evaluateTrustPolicy(high, policy, Date.now()).decision, "DENY");
});

test("deterministic local search ranks matching entries and applies the type filter", () => {
  const records = createLocalCatalog();
  const request = parseArdSearchRequest({
    query: { text: "review my pull request", filter: { type: [ARD_MEDIA_TYPES.agentSkill] } },
    federation: "none",
    pageSize: 5,
  });
  const first = searchLocalCatalog(request, records, "https://aegisone.example/search");
  const second = searchLocalCatalog(request, records, "https://aegisone.example/search");
  assert.deepEqual(first, second);
  assert.equal(first.results.length, 1);
  assert.equal(first.results[0]!.type, ARD_MEDIA_TYPES.agentSkill);
  assert.equal(first.results[0]!.identifier, "urn:air:aegisone.example:skill:pull-request-reviewer");
  assert.ok(first.results[0]!.score > 0 && first.results[0]!.score <= 100);
  assert.deepEqual(first.referrals, []);
});

test("parser rejects unsupported filters and unsupported federation explicitly", () => {
  assert.throws(
    () => parseArdSearchRequest({ query: { text: "weather", filter: { "trustManifest.identity": ["did:web:example"] } } }),
    (error: unknown) => error instanceof Error && error.message.includes("unsupported query.filter"),
  );
  assert.throws(
    () => parseArdSearchRequest({ query: { text: "weather", filter: { type: ["application/not-supported"] } } }),
    /does not support media type/,
  );
  assert.throws(
    () => parseArdSearchRequest({ query: { text: "weather" }, federation: "auto" }),
    /federation=none only/,
  );
});

test("parser enforces malformed-input, query-length, and result-count limits", () => {
  assert.throws(() => parseArdSearchRequest(null), /JSON object/);
  assert.throws(() => parseArdSearchRequest({}), /query must be/);
  assert.throws(() => parseArdSearchRequest({ query: { text: "" } }), /query.text is required/);
  assert.throws(() => parseArdSearchRequest({ query: { text: "x".repeat(2_001) } }), /at most 2000/);
  assert.throws(() => parseArdSearchRequest({ query: { text: "weather" }, pageSize: ARD_MAX_PAGE_SIZE + 1 }), /pageSize/);
  assert.throws(() => parseArdSearchRequest({ query: { text: "weather", unexpected: true } }), /unsupported field/);

  const request = parseArdSearchRequest({ query: { text: "api invoice" }, pageSize: 1 });
  assert.equal(searchLocalCatalog(request, createLocalCatalog(), "https://aegisone.example/search").results.length, 1);
});
