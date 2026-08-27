import assert from "node:assert/strict";
import { test } from "node:test";
import { InMemoryCatalogStore } from "../src/memory.ts";
import { deriveVerdictFromHighestSeverity } from "../src/pasted-skill-verdict.ts";
import type { NewPastedSkillScan } from "../src/model.ts";

function scanInput(overrides: Partial<NewPastedSkillScan> = {}): NewPastedSkillScan {
  return {
    contentSha256: "a".repeat(64),
    verdict: "CLEAN",
    highestSeverity: "INFO",
    findingCount: 0,
    findings: [],
    ...overrides,
  };
}

test("deriveVerdictFromHighestSeverity maps severities to the documented thresholds", () => {
  assert.equal(deriveVerdictFromHighestSeverity("INFO"), "CLEAN");
  assert.equal(deriveVerdictFromHighestSeverity("LOW"), "CLEAN");
  assert.equal(deriveVerdictFromHighestSeverity("MEDIUM"), "FLAGGED");
  assert.equal(deriveVerdictFromHighestSeverity("HIGH"), "FLAGGED");
  assert.equal(deriveVerdictFromHighestSeverity("CRITICAL"), "BLACKLISTED");
});

test("createOrTouchPastedSkillScan creates a new row with cached: false on first submission", async () => {
  const store = new InMemoryCatalogStore();
  const { scan, cached } = await store.createOrTouchPastedSkillScan(scanInput());
  assert.equal(cached, false);
  assert.equal(scan.scanCount, 1);
  assert.equal(scan.contentSha256, "a".repeat(64));
  assert.equal(scan.firstScannedAt, scan.lastScannedAt);
});

test("createOrTouchPastedSkillScan hits the cache on a repeated identical-content submission", async () => {
  const store = new InMemoryCatalogStore();
  const first = await store.createOrTouchPastedSkillScan(scanInput());
  assert.equal(first.cached, false);

  const second = await store.createOrTouchPastedSkillScan(scanInput());
  assert.equal(second.cached, true);
  assert.equal(second.scan.id, first.scan.id);
  assert.equal(second.scan.contentSha256, first.scan.contentSha256);
  assert.equal(second.scan.scanCount, 2);
  assert.equal(second.scan.firstScannedAt, first.scan.firstScannedAt);
});

test("createOrTouchPastedSkillScan never overwrites a stored verdict on a cache hit, even if the caller passes a different one", async () => {
  const store = new InMemoryCatalogStore();
  await store.createOrTouchPastedSkillScan(scanInput({ verdict: "BLACKLISTED", highestSeverity: "CRITICAL", findingCount: 1 }));

  // Same content hash, but the caller (hypothetically, adversarially) tries to submit a
  // different verdict for the same hash — the cache must win, never the caller's input.
  const { scan, cached } = await store.createOrTouchPastedSkillScan(scanInput({ verdict: "CLEAN", highestSeverity: "INFO", findingCount: 0 }));
  assert.equal(cached, true);
  assert.equal(scan.verdict, "BLACKLISTED");
  assert.equal(scan.highestSeverity, "CRITICAL");
});

test("getPastedSkillScanByContentHash returns null for an unseen content hash — never invents a verdict", async () => {
  const store = new InMemoryCatalogStore();
  const result = await store.getPastedSkillScanByContentHash("f".repeat(64));
  assert.equal(result, null);
});

test("getPastedSkillScanByContentHash independently answers the blacklist question without resubmitting content", async () => {
  const store = new InMemoryCatalogStore();
  await store.createOrTouchPastedSkillScan(scanInput({ contentSha256: "b".repeat(64), verdict: "BLACKLISTED", highestSeverity: "CRITICAL", findingCount: 3 }));
  const scan = await store.getPastedSkillScanByContentHash("b".repeat(64));
  assert.equal(scan?.verdict, "BLACKLISTED");
});
