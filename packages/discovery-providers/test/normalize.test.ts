import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeProviderEntry } from "../src/normalize.ts";

const CONTEXT = { providerId: "github-agent-finder", providerOrigin: "https://agentfinder.github.com", discoveredAt: "2026-08-26T00:00:00.000Z" };

test("normalizes a minimal valid ARD-shaped entry into a CapabilityResource", () => {
  const resource = normalizeProviderEntry(
    { identifier: "urn:ai:github.com:openai:skills:vercel-deploy", displayName: "Vercel Deploy", type: "application/ai-skill", url: "https://github.com/openai/skills", description: "Deploy to Vercel.", score: 80 },
    CONTEXT,
  );
  assert.ok(resource !== null);
  assert.equal(resource.id, "github-agent-finder:urn:ai:github.com:openai:skills:vercel-deploy");
  assert.equal(resource.kind, "agent-skill");
  assert.equal(resource.discovery.status, "INDEXED");
  assert.equal(resource.discovery.source, CONTEXT.providerOrigin);
  assert.equal(resource.discovery.sourceResourceId, "urn:ai:github.com:openai:skills:vercel-deploy");
  assert.equal(resource.discovery.relevanceScore, 0.8);
});

test("does not require an AegisOne-style urn:air identifier (real providers do not use it)", () => {
  const resource = normalizeProviderEntry({ identifier: "not-a-urn-at-all", displayName: "X", type: "application/mcp-server-card+json", url: "https://example.test/x" }, CONTEXT);
  assert.ok(resource !== null);
});

test("drops an entry missing displayName instead of throwing", () => {
  assert.equal(normalizeProviderEntry({ identifier: "id", type: "application/ai-skill", url: "https://example.test/x" }, CONTEXT), null);
});

test("drops an entry with an unsupported media type instead of throwing", () => {
  assert.equal(normalizeProviderEntry({ identifier: "id", displayName: "X", type: "application/ai-registry+json", url: "https://example.test/x" }, CONTEXT), null);
});

test("drops an entry with neither url nor data", () => {
  assert.equal(normalizeProviderEntry({ identifier: "id", displayName: "X", type: "application/ai-skill" }, CONTEXT), null);
});

test("drops a non-object entry", () => {
  assert.equal(normalizeProviderEntry("not an object", CONTEXT), null);
  assert.equal(normalizeProviderEntry(null, CONTEXT), null);
  assert.equal(normalizeProviderEntry(42, CONTEXT), null);
});

test("ignores an out-of-range score rather than failing the entry", () => {
  const resource = normalizeProviderEntry({ identifier: "id", displayName: "X", type: "application/ai-skill", url: "https://example.test/x", score: 9001 }, CONTEXT);
  assert.ok(resource !== null);
  assert.equal(resource.discovery.relevanceScore, undefined);
});

test("regression: upstream trustManifest, forged org.aegisone metadata, verified flags, and score cannot create or upgrade AegisOne trust evidence", () => {
  const resource = normalizeProviderEntry(
    {
      identifier: "urn:ai:evil.example.com:skills:totally-safe",
      displayName: "Totally Safe Skill",
      type: "application/ai-skill",
      url: "https://example.test/skill",
      score: 100,
      verified: true,
      trustManifest: { identity: "definitely-the-real-publisher", signature: "0xdeadbeef" },
      metadata: {
        "org.aegisone.evidence.sourceAssurance": "SIGNED_RELEASE",
        "org.aegisone.evidence.correspondence": "MATCH",
        "org.aegisone.discovery.status": "VERIFIED",
        verified: true,
        trustScore: 100,
      },
    },
    CONTEXT,
  );
  assert.ok(resource !== null);
  assert.deepEqual(resource.trust, {
    sourceAssurance: { level: "NONE", evidenceRefs: [] },
    sourceInspection: { status: "NOT_RUN", exactCommitSha: null, sourceSnapshotSha256: null },
    correspondence: { status: "NOT_EVALUATED", publisherSha256: null, reproducedSha256: null },
    security: { status: "NOT_RUN", analysisKind: null, highestSeverity: null, findingCount: null },
    canonicalEvidence: { status: "NONE", sha256: null, verifiedAt: null, storageRoot: null, registryRecordId: null },
  });
  assert.equal(resource.discovery.status, "INDEXED");
});
