import assert from "node:assert/strict";
import { test } from "node:test";
import { SupabaseCatalogStore } from "../src/supabase.ts";
import type { NewPastedSkillScan } from "../src/model.ts";

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

const row = {
  id: "77777777-7777-4777-8777-777777777777",
  content_sha256: "c".repeat(64),
  verdict: "FLAGGED",
  highest_severity: "MEDIUM",
  finding_count: 1,
  findings_json: [{ ruleId: "PR-SKILL-007", title: "x", severity: "MEDIUM", path: "a.sh", line: 1, evidence: "a.sh" }],
  first_scanned_at: "2026-08-27T00:00:00.000Z",
  last_scanned_at: "2026-08-27T00:00:00.000Z",
  scan_count: 1,
  created_at: "2026-08-27T00:00:00.000Z",
  updated_at: "2026-08-27T00:00:00.000Z",
};

const NEW_SCAN: NewPastedSkillScan = {
  contentSha256: row.content_sha256,
  verdict: "FLAGGED",
  highestSeverity: "MEDIUM",
  findingCount: 1,
  findings: [{ ruleId: "PR-SKILL-007", title: "x", severity: "MEDIUM", path: "a.sh", line: 1, evidence: "a.sh" }],
};

test("SupabaseCatalogStore.createOrTouchPastedSkillScan maps the row and cached flag", async () => {
  const store = makeStore((action) => {
    assert.equal(action, "createOrTouchPastedSkillScan");
    return { pastedSkillScan: row, cached: false };
  });
  const { scan, cached } = await store.createOrTouchPastedSkillScan(NEW_SCAN);
  assert.equal(cached, false);
  assert.equal(scan.id, row.id);
  assert.equal(scan.contentSha256, row.content_sha256);
  assert.equal(scan.verdict, "FLAGGED");
  assert.equal(scan.findingCount, 1);
  assert.deepEqual(scan.findings, NEW_SCAN.findings);
});

test("SupabaseCatalogStore.createOrTouchPastedSkillScan throws when the edge function omits the row", async () => {
  const store = makeStore(() => ({}));
  await assert.rejects(() => store.createOrTouchPastedSkillScan(NEW_SCAN));
});

test("SupabaseCatalogStore.getPastedSkillScanByContentHash returns null for an unseen hash", async () => {
  const store = makeStore((action) => {
    assert.equal(action, "getPastedSkillScanByContentHash");
    return { pastedSkillScan: null };
  });
  const scan = await store.getPastedSkillScanByContentHash("d".repeat(64));
  assert.equal(scan, null);
});
