import assert from "node:assert/strict";
import { test } from "node:test";
import { createJobStoreFromEnv, InMemoryJobStore, SupabaseJobStore } from "../src/index.ts";

const baseJob = {
  projectId: "hello-proofrail@1",
  sourceRepository: "https://github.com/Ollie202/proofrail-0g.git",
  sourceCommitSha: "e9c82277cef2f7630977e2473664e14eed2f860d",
  publisherArtifactName: "hello-proofrail.json",
};

test("memory store creates an operational job without a mutable verdict", async () => {
  const store = new InMemoryJobStore();
  const job = await store.create(baseJob);
  assert.equal(job.status, "queued");
  assert.equal(job.artifactKind, "software");
  assert.equal(job.verificationJson, null);
  assert.equal("verdict" in job, false);
  assert.equal(job.evidence.storageRoot, null);
});

test("memory store keeps evidence pointers separate from pipeline status", async () => {
  const store = new InMemoryJobStore();
  const created = await store.create({ ...baseJob, artifactKind: "agent-skill" });
  const updated = await store.update(created.id, {
    status: "verified",
    evidence: { storageRoot: "0xabc", registryRecordId: "0xdef" },
  });
  assert.equal(updated.status, "verified");
  assert.equal(updated.artifactKind, "agent-skill");
  assert.equal(updated.evidence.storageRoot, "0xabc");
  assert.equal(updated.evidence.registryRecordId, "0xdef");
  assert.equal(updated.verificationJson, null);
});

test("environment factory only uses memory when explicitly requested", () => {
  const store = createJobStoreFromEnv({ PROOFRAIL_JOB_STORE: "memory" });
  assert.ok(store instanceof InMemoryJobStore);
  assert.throws(() => createJobStoreFromEnv({}), /SUPABASE_URL/);
  assert.ok(createJobStoreFromEnv({
    SUPABASE_URL: "https://proofrail.supabase.co",
    SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
    PROOFRAIL_SUPABASE_APP_TOKEN: "app-secret",
  }) instanceof SupabaseJobStore);
});

test("Supabase adapter uses token-gated Edge Function without inventing a verdict", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const row = {
    id: "11111111-1111-4111-8111-111111111111",
    owner_id: null,
    created_at: "2026-08-18T08:00:00.000Z",
    updated_at: "2026-08-18T08:00:00.000Z",
    status: "queued",
    artifact_kind: "software",
    project_id: baseJob.projectId,
    source_repository: baseJob.sourceRepository,
    source_commit_sha: baseJob.sourceCommitSha,
    source_subdirectory: null,
    publisher_artifact_name: baseJob.publisherArtifactName,
    publisher_artifact_sha256: null,
    manifest_sha256: null,
    storage_root: null,
    storage_transaction: null,
    registry_contract: null,
    registry_transaction: null,
    registry_record_id: null,
    verification_json: null,
    failure_code: null,
    failure_message: null,
  };
  const fakeFetch = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    requests.push({ url: String(url), init });
    return new Response(JSON.stringify({ rows: [row] }), { status: 200, headers: { "content-type": "application/json" } });
  };
  const store = new SupabaseJobStore({
    url: "https://proofrail.supabase.co",
    publishableKey: "sb_publishable_test",
    appToken: "server-app-secret",
    fetcher: fakeFetch as typeof fetch,
  });
  const job = await store.create(baseJob);
  assert.equal(job.id, row.id);
  assert.equal("verdict" in job, false);
  assert.equal(requests.length, 1);
  assert.equal(requests[0]!.init?.method, "POST");
  const headers = requests[0]!.init?.headers as Record<string, string>;
  assert.equal(headers.authorization, "Bearer sb_publishable_test");
  assert.equal(headers["x-proofrail-app-token"], "server-app-secret");
  assert.match(requests[0]!.url, /functions\/v1\/proofrail-jobs$/);
  const body = JSON.parse(String(requests[0]!.init?.body));
  assert.equal(body.action, "create");
  assert.equal(body.input.projectId, baseJob.projectId);
});
