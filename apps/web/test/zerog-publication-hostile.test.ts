import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { test } from "node:test";
import { InMemoryJobStore } from "../../../packages/job-store/src/index.ts";
import {
  InMemoryCatalogStore,
  type CapabilityVerification,
} from "../../../packages/catalog-store/src/index.ts";
import type { CapabilityResource } from "../../../packages/capability-model/src/index.ts";
import {
  buildCanonicalEvidenceManifest,
  type PublicationEvidenceFacts,
} from "../../../packages/evidence-publish/src/index.ts";
import { createProductRequestHandler } from "../src/product.ts";

/**
 * ============================================================================================
 * "STORED ON 0G" MUST BE UNFAKEABLE FROM THE DATABASE
 * ============================================================================================
 * `m8-11-hostile-full-stack.test.ts` already proves a *malformed* hostile row cannot manufacture
 * MATCH/REPOSITORY_AUTHENTICATED. This file proves the harder case for the state PR 3/4 adds: a
 * hostile row that is **completely well-formed** — it passes `validateNewCapabilityVerification`,
 * carries a structurally valid non-zero 32-byte storage root, a valid transaction hash, a valid
 * SHA-256 canonical evidence digest and a valid timestamp — and yet claims a 0G publication that
 * never happened.
 *
 * This is the realistic version of Threat M8-012: not a corrupted row, but a *plausible* one
 * written by someone with database access who wants a resource to display the strongest state
 * AegisOne has. Structural validation alone cannot catch it. Only the manifest re-computation can,
 * because the canonical evidence digest is bound to the storage root (see
 * `packages/evidence-publish/src/manifest.ts`).
 *
 * Asserted across the full stack: the HTML Verified Library, the Evidence Passport, the REST API
 * and the evidence endpoint. None of them may show the forged root or the STORED ON 0G state.
 */

const RESOURCE_ID = "aegisone-repository-fixture:zerog-publication-hostile";
const VERSION_KEY = "1.0.0";

/** A structurally perfect but entirely fabricated storage root and transaction. */
const FORGED_ROOT = `0x${"ab".repeat(32)}`;
const FORGED_TX = `0x${"cd".repeat(32)}`;

function hostileResource(): CapabilityResource {
  return {
    schemaVersion: "1",
    id: RESOURCE_ID,
    kind: "agent-skill",
    name: "Row Claims 0G Storage",
    description: "A resource whose catalog row asserts a 0G publication that never happened.",
    discovery: {
      status: "INDEXED",
      source: "aegisone-repository-fixture",
      sourceResourceId: "zerog-publication-hostile",
      resourceUrl: "https://github.com/hostile-publisher/zerog-publication-hostile",
      discoveredAt: "2026-08-28T00:00:00.000Z",
    },
    currentVersion: {
      id: VERSION_KEY,
      versionLabel: VERSION_KEY,
      source: {
        repositoryUrl: "https://github.com/hostile-publisher/zerog-publication-hostile",
        commitSha: "a".repeat(40),
        subdirectory: null,
      },
      distribution: { url: "https://hostile.example/skill.skillpkg", sha256: "b".repeat(64) },
    },
    trust: {
      sourceAssurance: { level: "NONE", evidenceRefs: [] },
      sourceInspection: { status: "NOT_RUN", exactCommitSha: null, sourceSnapshotSha256: null },
      correspondence: { status: "NOT_EVALUATED", publisherSha256: null, reproducedSha256: null },
      security: { status: "NOT_RUN", analysisKind: null, highestSeverity: null, findingCount: null },
      canonicalEvidence: { status: "NONE", sha256: null, verifiedAt: null, storageRoot: null, registryRecordId: null },
    },
  };
}

/** The hostile row. Every field is individually valid; the *pairing* is the lie. */
function forgedPublicationRow(versionId: string, canonicalEvidenceSha256: string): CapabilityVerification {
  return {
    id: "forged-publication-1",
    resourceVersionId: versionId,
    sourceClaimId: null,
    verificationJobId: null,
    artifactKind: "agent-skill",
    sourceInspectionStatus: "NOT_RUN",
    sourceSnapshotSha256: null,
    correspondenceStatus: "NOT_EVALUATED",
    publisherSha256: null,
    reproducedSha256: null,
    securityStatus: "COMPLETED",
    securityHighestSeverity: "INFO",
    securityFindingCount: 0,
    canonicalEvidenceSha256,
    storageRoot: FORGED_ROOT,
    storageTransaction: FORGED_TX,
    registryContract: "0x227Fcc243f25c395C93Df789EC72Bc75bf096017",
    registryRecordId: `0x${"ef".repeat(32)}`,
    registryTransaction: `0x${"12".repeat(32)}`,
    verifiedAt: "2026-08-28T00:00:00.000Z",
    createdAt: "2026-08-28T00:00:00.000Z",
  };
}

class ForgedPublicationStore extends InMemoryCatalogStore {
  #versionId: string | null = null;
  #row: CapabilityVerification | null = null;

  arm(versionId: string, canonicalEvidenceSha256: string): void {
    this.#versionId = versionId;
    this.#row = forgedPublicationRow(versionId, canonicalEvidenceSha256);
  }

  override async getLatestCapabilityVerification(resourceVersionId: string): Promise<CapabilityVerification | null> {
    if (resourceVersionId === this.#versionId && this.#row) return this.#row;
    return super.getLatestCapabilityVerification(resourceVersionId);
  }

  override async listCapabilityVerificationsByResourceVersion(resourceVersionId: string): Promise<CapabilityVerification[]> {
    if (resourceVersionId === this.#versionId && this.#row) return [this.#row];
    return super.listCapabilityVerificationsByResourceVersion(resourceVersionId);
  }
}

async function startTestServer(catalogStore: InMemoryCatalogStore): Promise<{ baseUrl: string; server: Server }> {
  const handler = createProductRequestHandler(new InMemoryJobStore(), {
    publicBaseUrl: "https://aegisone.example",
    catalogStore,
    githubSourceAuthConfig: null,
    secureSourceAuthCookies: false,
  });
  const server = createServer((request, response) => {
    void handler(request, response).catch((error) => {
      response.writeHead(500, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "internal_error", message: String(error) }));
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("test server did not bind a TCP port");
  return { baseUrl: `http://127.0.0.1:${address.port}`, server };
}

async function stopTestServer(server: Server): Promise<void> {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

/** The catalog store assigns its own resource/version ids on upsert, so the tests address the
 * resource by the id it actually got rather than by the discovery key. */
async function armedStore(canonicalEvidenceSha256: string): Promise<{ store: ForgedPublicationStore; resourceId: string }> {
  const store = new ForgedPublicationStore();
  const { resource, version } = await store.upsertDiscoveredResource(hostileResource());
  store.arm(version.id, canonicalEvidenceSha256);
  return { store, resourceId: resource.id };
}

test("a well-formed row with an arbitrary canonical digest cannot produce a 0G storage root", async () => {
  // The attacker simply invents a digest alongside the forged root.
  const { store, resourceId } = await armedStore("9".repeat(64));
  const { baseUrl, server } = await startTestServer(store);
  try {
    const api = await (await fetch(`${baseUrl}/api/v1/resources/${encodeURIComponent(resourceId)}`)).json();
    assert.equal(api.resource.trust.canonicalEvidence.storageRoot, null, "a forged root must never be served");
    assert.equal(api.resource.trust.canonicalEvidence.registryRecordId, null, "the record id is gated on the same check");
    assert.equal(api.integrity.storagePublication.ok, false);
    assert.equal(api.integrity.storagePublication.reason, "MANIFEST_DIGEST_MISMATCH");
  } finally {
    await stopTestServer(server);
  }
});

test("even a digest computed over the row's own facts cannot fake a root the manifest does not bind", async () => {
  // The sophisticated attempt: the attacker knows the manifest format and computes a *valid*
  // canonical evidence digest — but over a DIFFERENT root than the one they wrote into the row.
  // This is what makes the binding load-bearing rather than decorative.
  const facts: PublicationEvidenceFacts = {
    artifactKind: "agent-skill",
    resourceVersionId: VERSION_KEY,
    sourceInspectionStatus: "NOT_RUN",
    sourceSnapshotSha256: null,
    correspondenceStatus: "NOT_EVALUATED",
    publisherSha256: null,
    reproducedSha256: null,
    securityStatus: "COMPLETED",
    securityHighestSeverity: "INFO",
    securityFindingCount: 0,
    verifiedAt: "2026-08-28T00:00:00.000Z",
  };
  const otherRootManifest = buildCanonicalEvidenceManifest(facts, {
    network: "0G Galileo Testnet",
    chainId: 16602,
    root: `0x${"99".repeat(32)}`,
    transaction: FORGED_TX,
  });

  const { store, resourceId } = await armedStore(otherRootManifest.sha256);
  const { baseUrl, server } = await startTestServer(store);
  try {
    const api = await (await fetch(`${baseUrl}/api/v1/resources/${encodeURIComponent(resourceId)}`)).json();
    assert.equal(api.resource.trust.canonicalEvidence.storageRoot, null);
    assert.equal(api.integrity.storagePublication.ok, false);
    assert.equal(api.integrity.storagePublication.reason, "MANIFEST_DIGEST_MISMATCH");
  } finally {
    await stopTestServer(server);
  }
});

test("the forged root never appears in any HTML surface, and STORED ON 0G is never rendered for it", async () => {
  const { store, resourceId } = await armedStore("9".repeat(64));
  const { baseUrl, server } = await startTestServer(store);
  try {
    const library = await (await fetch(`${baseUrl}/verified`)).text();
    const passport = await (await fetch(`${baseUrl}/resources/${encodeURIComponent(resourceId)}`)).text();
    const skills = await (await fetch(`${baseUrl}/`)).text();

    for (const [name, html] of [["/verified", library], ["/resources/:id", passport], ["/", skills]] as const) {
      assert.ok(!html.includes(FORGED_ROOT), `${name} must never render the forged storage root`);
      assert.ok(!html.includes(FORGED_TX), `${name} must never render the forged storage transaction`);
      assert.ok(!html.includes("ON 0G STORAGE"), `${name} must not show the positive 0G storage badge for a forged row`);
    }

    // The library states the absence explicitly rather than silently omitting the row.
    assert.match(library, /not established/);
  } finally {
    await stopTestServer(server);
  }
});

test("the evidence endpoint also refuses to serve the forged publication pointers", async () => {
  const { store, resourceId } = await armedStore("9".repeat(64));
  const { baseUrl, server } = await startTestServer(store);
  try {
    const body = await (await fetch(`${baseUrl}/api/v1/resources/${encodeURIComponent(resourceId)}/evidence`)).text();
    assert.ok(!body.includes(FORGED_ROOT), "the evidence endpoint must never serve the forged root");
    assert.ok(!body.includes(FORGED_TX), "the evidence endpoint must never serve the forged transaction");
  } finally {
    await stopTestServer(server);
  }
});

test("a genuine publication IS shown, so the gate is a real check and not a blanket refusal", async () => {
  // The control case. Without this, every assertion above would pass trivially if the gate simply
  // rejected everything. Here the row is built the way a real publication builds it: the canonical
  // evidence digest is computed over the row's own facts AND the root actually stored.
  const store = new ForgedPublicationStore();
  const { resource, version } = await store.upsertDiscoveredResource(hostileResource());
  const facts: PublicationEvidenceFacts = {
    artifactKind: "agent-skill",
    resourceVersionId: version.id,
    sourceInspectionStatus: "NOT_RUN",
    sourceSnapshotSha256: null,
    correspondenceStatus: "NOT_EVALUATED",
    publisherSha256: null,
    reproducedSha256: null,
    securityStatus: "COMPLETED",
    securityHighestSeverity: "INFO",
    securityFindingCount: 0,
    verifiedAt: "2026-08-28T00:00:00.000Z",
  };
  const manifest = buildCanonicalEvidenceManifest(facts, {
    network: "0G Galileo Testnet",
    chainId: 16602,
    root: FORGED_ROOT,
    transaction: FORGED_TX,
  });
  store.arm(version.id, manifest.sha256);

  const { baseUrl, server } = await startTestServer(store);
  try {
    const api = await (await fetch(`${baseUrl}/api/v1/resources/${encodeURIComponent(resource.id)}`)).json();
    assert.equal(api.integrity.storagePublication.ok, true, "a coherent publication must pass the gate");
    assert.equal(api.resource.trust.canonicalEvidence.storageRoot, FORGED_ROOT.toLowerCase());

    // The evidence endpoint agrees with the resource endpoint about the same row — the two
    // surfaces must never disagree about whether a publication is presentable.
    const evidence = await (await fetch(`${baseUrl}/api/v1/resources/${encodeURIComponent(resource.id)}/evidence`)).json();
    assert.equal(evidence.capabilityVerifications[0].publicationIntegrityCheckPassed, true);
    assert.equal(evidence.capabilityVerifications[0].storageRoot, FORGED_ROOT);

    // And the Evidence Passport renders the root plus the positive 0G storage badge.
    const passport = await (await fetch(`${baseUrl}/resources/${encodeURIComponent(resource.id)}`)).text();
    assert.ok(passport.includes(FORGED_ROOT.toLowerCase()), "a passing publication's root is shown on the passport");
    assert.match(passport, /ON 0G STORAGE/);
  } finally {
    await stopTestServer(server);
  }
});
