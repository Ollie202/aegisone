import assert from "node:assert/strict";
import { test } from "node:test";
import { SupabaseCatalogStore } from "../src/supabase.ts";
import type { NewCapabilityVerification } from "../src/model.ts";

function makeStore(responder: (action: string, body: Record<string, unknown>) => unknown) {
  const fakeFetch = async (_url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const body = JSON.parse(String(init?.body)) as { action: string } & Record<string, unknown>;
    const { action, ...rest } = body;
    return new Response(JSON.stringify(responder(action, rest)), { status: 200, headers: { "content-type": "application/json" } });
  };
  return new SupabaseCatalogStore({
    url: "https://proofrail.supabase.co",
    publishableKey: "sb_publishable_test",
    appToken: "server-app-secret",
    fetcher: fakeFetch as typeof fetch,
  });
}

const row = {
  id: "66666666-6666-4666-8666-666666666666",
  resource_version_id: "33333333-3333-4333-8333-333333333333",
  source_claim_id: "44444444-4444-4444-8444-444444444444",
  verification_job_id: null,
  artifact_kind: "agent-skill",
  source_inspection_status: "INSPECTED",
  correspondence_status: "MATCH",
  publisher_sha256: "a".repeat(64),
  reproduced_sha256: "a".repeat(64),
  security_status: "COMPLETED",
  security_highest_severity: "INFO",
  security_finding_count: 0,
  canonical_evidence_sha256: "b".repeat(64),
  storage_root: "0xroot",
  storage_transaction: "0xstoragetx",
  registry_contract: "0xregistry",
  registry_record_id: "0xrecord",
  registry_transaction: "0xregistrytx",
  verified_at: "2026-08-26T00:00:00.000Z",
  created_at: "2026-08-26T00:00:00.000Z",
};

const NEW_VERIFICATION: NewCapabilityVerification = {
  resourceVersionId: row.resource_version_id,
  sourceClaimId: row.source_claim_id,
  verificationJobId: null,
  artifactKind: "agent-skill",
  sourceInspectionStatus: "INSPECTED",
  correspondenceStatus: "MATCH",
  publisherSha256: row.publisher_sha256,
  reproducedSha256: row.reproduced_sha256,
  securityStatus: "COMPLETED",
  securityHighestSeverity: "INFO",
  securityFindingCount: 0,
  canonicalEvidenceSha256: row.canonical_evidence_sha256,
  storageRoot: row.storage_root,
  storageTransaction: row.storage_transaction,
  registryContract: row.registry_contract,
  registryRecordId: row.registry_record_id,
  registryTransaction: row.registry_transaction,
  verifiedAt: row.verified_at,
};

test("createCapabilityVerification sends the correct edge-function action and normalizes the response", async () => {
  const store = makeStore((action, body) => {
    assert.equal(action, "createCapabilityVerification");
    assert.equal(body.resourceVersionId, NEW_VERIFICATION.resourceVersionId);
    assert.equal(body.correspondenceStatus, "MATCH");
    return { capabilityVerification: row };
  });
  const result = await store.createCapabilityVerification(NEW_VERIFICATION);
  assert.equal(result.id, row.id);
  assert.equal(result.correspondenceStatus, "MATCH");
  assert.equal(result.publisherSha256, row.publisher_sha256);
});

test("createCapabilityVerification rejects a malformed row locally, before calling the edge function", async () => {
  let called = false;
  const store = makeStore(() => { called = true; return { capabilityVerification: row }; });
  await assert.rejects(store.createCapabilityVerification({
    ...NEW_VERIFICATION,
    correspondenceStatus: "MATCH",
    reproducedSha256: null,
  }));
  assert.equal(called, false);
});

test("getLatestCapabilityVerification returns null when the edge function reports no row", async () => {
  const store = makeStore(() => ({ capabilityVerification: null }));
  assert.equal(await store.getLatestCapabilityVerification("missing"), null);
});

test("listCapabilityVerificationsByResourceVersion normalizes each row", async () => {
  const store = makeStore((action) => {
    assert.equal(action, "listCapabilityVerificationsByResourceVersion");
    return { rows: [row] };
  });
  const rows = await store.listCapabilityVerificationsByResourceVersion(row.resource_version_id);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.id, row.id);
});
