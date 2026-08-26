import assert from "node:assert/strict";
import { test } from "node:test";
import { SupabaseCatalogStore } from "../src/supabase.ts";
import type { NewSourceClaim } from "../src/model.ts";

function makeStore(responder: (action: string, body: Record<string, unknown>) => unknown) {
  const fakeFetch = async (_url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const body = JSON.parse(String(init?.body)) as { action: string } & Record<string, unknown>;
    const { action, ...rest } = body;
    return new Response(JSON.stringify(responder(action, rest)), { status: 200, headers: { "content-type": "application/json" } });
  };
  return new SupabaseCatalogStore({
    url: "https://aegisone.supabase.co",
    publishableKey: "sb_publishable_test",
    appToken: "server-app-secret",
    fetcher: fakeFetch as typeof fetch,
  });
}

const sourceClaimRow = {
  id: "44444444-4444-4444-8444-444444444444",
  resource_version_id: "33333333-3333-4333-8333-333333333333",
  provider: "github",
  assurance_level: "REPOSITORY_AUTHENTICATED",
  claim_status: "active",
  source_repository: "acme/auditor",
  source_repository_id: 555,
  source_repository_node_id: "R_kgAA",
  source_owner_login: "acme",
  source_owner_id: 900,
  source_commit_sha: "a".repeat(40),
  source_subdirectory: null,
  distribution_url: null,
  distribution_sha256: null,
  claim_digest_sha256: "b".repeat(64),
  canonical_claim_json: { schemaVersion: "1" },
  authenticated_at: "2026-08-26T00:00:00.000Z",
  created_at: "2026-08-26T00:00:00.000Z",
  supersedes_claim_id: null,
};

const NEW_CLAIM: NewSourceClaim = {
  resourceVersionId: sourceClaimRow.resource_version_id,
  provider: "github",
  assuranceLevel: "REPOSITORY_AUTHENTICATED",
  sourceRepository: "acme/auditor",
  sourceRepositoryId: 555,
  sourceRepositoryNodeId: "R_kgAA",
  sourceOwnerLogin: "acme",
  sourceOwnerId: 900,
  sourceCommitSha: "a".repeat(40),
  sourceSubdirectory: null,
  distributionUrl: null,
  distributionSha256: null,
  claimDigestSha256: "b".repeat(64),
  canonicalClaimJson: { schemaVersion: "1" },
  authenticatedAt: "2026-08-26T00:00:00.000Z",
  authorityObservations: [{
    provider: "github",
    subjectType: "github-user",
    subjectId: "42",
    subjectLogin: "octocat",
    repositoryId: 555,
    observedPermission: "write",
    observedRoleName: "write",
    observationJson: { permission: "write" },
    observedAt: "2026-08-26T00:00:00.000Z",
  }],
};

test("createSourceClaim sends the correct edge-function action and normalizes the response", async () => {
  const store = makeStore((action, body) => {
    assert.equal(action, "createSourceClaim");
    assert.equal(body.resourceVersionId, NEW_CLAIM.resourceVersionId);
    assert.equal(body.claimDigestSha256, NEW_CLAIM.claimDigestSha256);
    return { sourceClaim: sourceClaimRow, authorityObservations: [], supersededClaimId: null, conflict: null };
  });
  const result = await store.createSourceClaim(NEW_CLAIM);
  assert.equal(result.claim.id, sourceClaimRow.id);
  assert.equal(result.claim.assuranceLevel, "REPOSITORY_AUTHENTICATED");
  assert.equal(result.conflict, null);
});

test("createSourceClaim surfaces an explicit conflict from the edge function", async () => {
  const store = makeStore(() => ({
    sourceClaim: { ...sourceClaimRow, claim_status: "conflicted" },
    authorityObservations: [],
    supersededClaimId: null,
    conflict: { type: "SOURCE_CLAIM_CONFLICT", conflictingClaimId: "55555555-5555-4555-8555-555555555555" },
  }));
  const result = await store.createSourceClaim(NEW_CLAIM);
  assert.equal(result.claim.claimStatus, "conflicted");
  assert.deepEqual(result.conflict, { type: "SOURCE_CLAIM_CONFLICT", conflictingClaimId: "55555555-5555-4555-8555-555555555555" });
});

test("getSourceClaim returns null when the edge function reports no row", async () => {
  const store = makeStore(() => ({ sourceClaim: null }));
  assert.equal(await store.getSourceClaim("missing"), null);
});

test("listActiveSourceClaimsByResourceVersion normalizes each row", async () => {
  const store = makeStore((action) => {
    assert.equal(action, "listActiveSourceClaimsByResourceVersion");
    return { rows: [sourceClaimRow] };
  });
  const claims = await store.listActiveSourceClaimsByResourceVersion(sourceClaimRow.resource_version_id);
  assert.equal(claims.length, 1);
  assert.equal(claims[0]?.id, sourceClaimRow.id);
});
