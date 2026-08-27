import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { InMemoryCatalogStore } from "../../../packages/catalog-store/src/index.ts";
import type { AdvisoryScanTransport } from "../../../packages/compute-0g/src/index.ts";
import { performPastedSkillScan, ScanServiceError, type ScanServiceDependencies } from "../src/scan-service.ts";
import { FixedWindowRateLimiter } from "../src/rate-limit.ts";

/**
 * Unit-level coverage for the paste-to-scan service function, independent of HTTP/MCP transport
 * (see apps/web/test/scan-api.test.ts and apps/web/test/mcp.test.ts for the transport-level
 * proof that both surfaces call this same function).
 */

async function readFixture(relativePath: string): Promise<string> {
  return readFile(fileURLToPath(new URL(`../../../examples/agent-skills/${relativePath}`, import.meta.url)), "utf8");
}

function deps(overrides: Partial<ScanServiceDependencies> = {}): ScanServiceDependencies {
  return {
    catalogStore: new InMemoryCatalogStore(),
    zeroGComputeConfig: null,
    scanRateLimiter: new FixedWindowRateLimiter(1000, 60_000),
    advisoryRateLimiter: new FixedWindowRateLimiter(1000, 60_000),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tier 1 verdicts against the existing repository fixtures (no invented fixtures)
// ---------------------------------------------------------------------------

test("the existing malicious-sync fixture scans as BLACKLISTED via Tier 1 alone", async () => {
  const skillMd = await readFixture("malicious-sync/SKILL.md");
  const extra = await readFixture("malicious-sync/extras/hidden.sh");
  const result = await performPastedSkillScan(
    { content: [{ path: "SKILL.md", content: skillMd }, { path: "extras/hidden.sh", content: extra }] },
    deps(),
    "test-client-1",
  );
  assert.equal(result.verdict, "BLACKLISTED");
  assert.equal(result.deterministicFindings.some((f) => f.severity === "CRITICAL"), true);
  assert.equal(result.advisoryFindings, null);
});

test("the existing clean-review fixture scans as CLEAN via Tier 1 alone", async () => {
  const skillMd = await readFixture("clean-review/SKILL.md");
  const script = await readFixture("clean-review/scripts/check.py");
  const result = await performPastedSkillScan(
    { content: [{ path: "SKILL.md", content: skillMd }, { path: "scripts/check.py", content: script }] },
    deps(),
    "test-client-2",
  );
  assert.equal(result.verdict, "CLEAN");
});

test("a single-string paste is treated as SKILL.md content", async () => {
  const skillMd = await readFixture("malicious-sync/SKILL.md");
  const result = await performPastedSkillScan({ content: skillMd }, deps(), "test-client-3");
  assert.equal(result.verdict, "BLACKLISTED");
});

// ---------------------------------------------------------------------------
// Caching
// ---------------------------------------------------------------------------

test("repeated identical-content submissions hit the cache: cached false then true, same hash, scanCount increments", async () => {
  const shared = deps();
  const content = "---\nname: foo\ndescription: a benign test skill for cache behavior\n---\nDo nothing unusual.";

  const first = await performPastedSkillScan({ content }, shared, "cache-client");
  assert.equal(first.cached, false);
  assert.equal(first.scanCount, 1);

  const second = await performPastedSkillScan({ content }, shared, "cache-client");
  assert.equal(second.cached, true);
  assert.equal(second.contentSha256, first.contentSha256);
  assert.equal(second.scanCount, 2);
  assert.equal(second.verdict, first.verdict);
});

// ---------------------------------------------------------------------------
// Malformed / oversized input
// ---------------------------------------------------------------------------

test("rejects a non-object request body", async () => {
  await assert.rejects(() => performPastedSkillScan("not an object", deps(), "client"), ScanServiceError);
});

test("rejects empty string content", async () => {
  await assert.rejects(() => performPastedSkillScan({ content: "" }, deps(), "client"), ScanServiceError);
});

test("rejects a content array with more than 50 files", async () => {
  const content = Array.from({ length: 51 }, (_, i) => ({ path: `f${i}.txt`, content: "x" }));
  await assert.rejects(() => performPastedSkillScan({ content }, deps(), "client"), ScanServiceError);
});

test("rejects content exceeding the total byte cap", async () => {
  const content = "x".repeat(256 * 1024 + 1);
  await assert.rejects(
    () => performPastedSkillScan({ content }, deps(), "client"),
    (error: unknown) => error instanceof ScanServiceError && error.status === 413,
  );
});

test("rejects a malformed content item shape", async () => {
  await assert.rejects(() => performPastedSkillScan({ content: [{ path: "a" }] }, deps(), "client"), ScanServiceError);
});

test("rejects path traversal in a content item path", async () => {
  await assert.rejects(
    () => performPastedSkillScan({ content: [{ path: "../../etc/passwd", content: "x" }] }, deps(), "client"),
    ScanServiceError,
  );
});

test("rejects a non-boolean includeAdvisoryScan", async () => {
  await assert.rejects(() => performPastedSkillScan({ content: "x", includeAdvisoryScan: "yes" }, deps(), "client"), ScanServiceError);
});

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

test("Tier 1 rate limiting returns a structured 429 once the scan limiter is exhausted", async () => {
  const limitedDeps = deps({ scanRateLimiter: new FixedWindowRateLimiter(1, 60_000) });
  await performPastedSkillScan({ content: "first" }, limitedDeps, "rate-client");
  await assert.rejects(
    () => performPastedSkillScan({ content: "second" }, limitedDeps, "rate-client"),
    (error: unknown) => error instanceof ScanServiceError && error.status === 429 && error.code === "scan_rate_limited",
  );
});

test("Tier 1 rate limiting is keyed independently per client", async () => {
  const limitedDeps = deps({ scanRateLimiter: new FixedWindowRateLimiter(1, 60_000) });
  await performPastedSkillScan({ content: "first" }, limitedDeps, "client-a");
  // A different client key must not be affected by client-a's limiter bucket.
  const result = await performPastedSkillScan({ content: "second" }, limitedDeps, "client-b");
  assert.equal(result.verdict, "CLEAN");
});

test("Tier 2 rate limiting never fails the whole request — it degrades advisoryFindings.status to rate_limited while verdict is still returned", async () => {
  const fakeTransport: AdvisoryScanTransport = {
    async requestChatCompletion() {
      return { content: '{"concernLevel":"none","summary":"ok"}', modelProvider: "test-provider" };
    },
  };
  const limitedDeps = deps({
    zeroGComputeConfig: { privateKey: "0xabc", modelProvider: "0xprovider", rpcUrl: "https://example.invalid" },
    advisoryTransport: fakeTransport,
    advisoryRateLimiter: new FixedWindowRateLimiter(1, 60_000),
  });
  const first = await performPastedSkillScan({ content: "first", includeAdvisoryScan: true }, limitedDeps, "advisory-client");
  assert.equal(first.advisoryFindings?.status, "completed");

  const second = await performPastedSkillScan({ content: "second", includeAdvisoryScan: true }, limitedDeps, "advisory-client");
  assert.equal(second.advisoryFindings?.status, "rate_limited");
  assert.ok(second.verdict, "the deterministic verdict must still be returned even when the advisory tier is rate-limited");
});

// ---------------------------------------------------------------------------
// Advisory tier: unavailable / completed / error, and non-authoritative invariants
// ---------------------------------------------------------------------------

test("includeAdvisoryScan without a configured 0G Compute key returns an explicit advisory_unavailable state, never a fabricated result", async () => {
  const result = await performPastedSkillScan({ content: "hello", includeAdvisoryScan: true }, deps({ zeroGComputeConfig: null }), "client");
  assert.equal(result.advisoryFindings?.status, "advisory_unavailable");
  assert.ok(!("finding" in (result.advisoryFindings ?? {})) || result.advisoryFindings!.finding === undefined);
});

test("includeAdvisoryScan omitted/false never calls the advisory transport at all", async () => {
  let called = false;
  const transport: AdvisoryScanTransport = {
    async requestChatCompletion() {
      called = true;
      return { content: '{"concernLevel":"none","summary":"ok"}', modelProvider: "p" };
    },
  };
  const result = await performPastedSkillScan(
    { content: "hello" },
    deps({ zeroGComputeConfig: { privateKey: "0xabc", modelProvider: "p", rpcUrl: "https://x.invalid" }, advisoryTransport: transport }),
    "client",
  );
  assert.equal(called, false);
  assert.equal(result.advisoryFindings, null);
});

test("a completed advisory finding is surfaced under advisoryFindings and never changes verdict", async () => {
  const skillMd = await readFixture("clean-review/SKILL.md");
  const transport: AdvisoryScanTransport = {
    async requestChatCompletion() {
      return { content: '{"concernLevel":"high","summary":"Looks manipulative despite passing static checks."}', modelProvider: "p" };
    },
  };
  const result = await performPastedSkillScan(
    { content: skillMd, includeAdvisoryScan: true },
    deps({ zeroGComputeConfig: { privateKey: "0xabc", modelProvider: "p", rpcUrl: "https://x.invalid" }, advisoryTransport: transport }),
    "client",
  );
  // The deterministic verdict is CLEAN regardless of the advisory opinion's high concern level —
  // the advisory tier can never upgrade/downgrade the stored/deterministic verdict.
  assert.equal(result.verdict, "CLEAN");
  assert.equal(result.advisoryFindings?.status, "completed");
  assert.equal(result.advisoryFindings?.finding?.concernLevel, "high");
});

test("an advisory transport failure surfaces as advisoryFindings.status error without failing the whole request", async () => {
  const transport: AdvisoryScanTransport = {
    async requestChatCompletion() {
      throw new Error("boom");
    },
  };
  const result = await performPastedSkillScan(
    { content: "hello", includeAdvisoryScan: true },
    deps({ zeroGComputeConfig: { privateKey: "0xabc", modelProvider: "p", rpcUrl: "https://x.invalid" }, advisoryTransport: transport }),
    "client",
  );
  assert.equal(result.verdict, "CLEAN");
  assert.equal(result.advisoryFindings?.status, "error");
});

// ---------------------------------------------------------------------------
// Non-negotiable invariant: sourceAssurance/correspondence are structurally unreachable here
// ---------------------------------------------------------------------------

test("a paste-to-scan response never carries a sourceAssurance/correspondence field or a MATCH/MISMATCH/REPOSITORY_AUTHENTICATED/SIGNED_RELEASE value", async () => {
  const result = await performPastedSkillScan({ content: "hello world" }, deps(), "client") as unknown as Record<string, unknown>;
  assert.equal("sourceAssurance" in result, false);
  assert.equal("correspondence" in result, false);
  const raw = JSON.stringify(result);
  for (const forbidden of ['"MATCH"', '"MISMATCH"', '"REPOSITORY_AUTHENTICATED"', '"SIGNED_RELEASE"', '"verified":true', '"safe":true']) {
    assert.ok(!raw.includes(forbidden), `response must never contain ${forbidden}`);
  }
});

test("scan-service.ts's parseScanContent/performPastedSkillScan functions never reference the M8.5/M8.6 source-claim vocabulary in code (only in comments)", async () => {
  const source = await readFile(fileURLToPath(new URL("../src/scan-service.ts", import.meta.url)), "utf8");
  // Strip line/block comments before checking, since the module's *documentation* legitimately
  // explains why these tokens are unreachable — the code itself must not, e.g., import
  // `computeSourceClaimDigest` or reference `SourceClaim`/`CapabilityVerification` types.
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  for (const forbidden of ["computeSourceClaimDigest", "SourceClaim", "CapabilityVerification", "assembleTrustEvidence", "buildCanonicalSourceClaim"]) {
    assert.ok(!withoutComments.includes(forbidden), `scan-service.ts code must not reference ${forbidden}`);
  }
});
