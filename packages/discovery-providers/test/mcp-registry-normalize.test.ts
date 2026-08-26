import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeMcpRegistryEntry } from "../src/mcp-registry-normalize.ts";

const CONTEXT = { discoveredAt: "2026-08-26T00:00:00.000Z" };
const BASE_URL = "https://registry.modelcontextprotocol.io";

test("normalizes a minimal valid Registry entry into a CapabilityResource", () => {
  const resource = normalizeMcpRegistryEntry(
    {
      server: {
        name: "io.github.acme/widgets",
        description: "Widget MCP server.",
        version: "1.0.0",
        repository: { url: "https://github.com/acme/widgets", source: "github" },
      },
      _meta: { "io.modelcontextprotocol.registry/official": { status: "active", isLatest: true } },
    },
    CONTEXT,
    BASE_URL,
  );
  assert.ok(resource !== null);
  assert.equal(resource.id, "mcp-official-registry:io.github.acme/widgets");
  assert.equal(resource.kind, "mcp-server");
  assert.equal(resource.discovery.status, "INDEXED");
  assert.equal(resource.discovery.source, BASE_URL);
  assert.equal(resource.discovery.sourceResourceId, "io.github.acme/widgets");
  // Prefers the repository URL when there is no remote endpoint.
  assert.equal(resource.discovery.resourceUrl, "https://github.com/acme/widgets");
  assert.ok(resource.currentVersion !== null);
  assert.equal(resource.currentVersion.versionLabel, "1.0.0");
  assert.equal(resource.currentVersion.id, "mcp-official-registry:io.github.acme/widgets@1.0.0");
});

test("prefers a live remote endpoint URL over the declared repository URL", () => {
  const resource = normalizeMcpRegistryEntry(
    {
      server: {
        name: "ac.inference.sh/mcp",
        title: "inference.sh",
        description: "Run AI models.",
        version: "2.0.1",
        remotes: [{ type: "streamable-http", url: "https://api.inference.sh/mcp" }],
        repository: { url: "https://github.com/inference-sh/mcp", source: "github" },
      },
      _meta: {},
    },
    CONTEXT,
    BASE_URL,
  );
  assert.ok(resource !== null);
  assert.equal(resource.discovery.resourceUrl, "https://api.inference.sh/mcp");
  assert.equal(resource.name, "inference.sh");
});

test("falls back to a stable Registry web pointer when there is no remote or repository URL", () => {
  const resource = normalizeMcpRegistryEntry(
    { server: { name: "io.github.acme/no-links", description: "No links here.", version: "1.0.0" }, _meta: {} },
    CONTEXT,
    BASE_URL,
  );
  assert.ok(resource !== null);
  assert.equal(resource.discovery.resourceUrl, `${BASE_URL}/v0.1/servers/io.github.acme%2Fno-links`);
});

test("drops an entry missing server.name", () => {
  assert.equal(normalizeMcpRegistryEntry({ server: { description: "x", version: "1.0.0" } }, CONTEXT, BASE_URL), null);
});

test("drops an entry missing server.version", () => {
  assert.equal(normalizeMcpRegistryEntry({ server: { name: "x", description: "x" } }, CONTEXT, BASE_URL), null);
});

test("drops an entry missing server.description", () => {
  assert.equal(normalizeMcpRegistryEntry({ server: { name: "x", version: "1.0.0" } }, CONTEXT, BASE_URL), null);
});

test("drops an entry with no server object at all", () => {
  assert.equal(normalizeMcpRegistryEntry({ _meta: {} }, CONTEXT, BASE_URL), null);
});

test("drops a non-object entry", () => {
  assert.equal(normalizeMcpRegistryEntry("nope", CONTEXT, BASE_URL), null);
  assert.equal(normalizeMcpRegistryEntry(null, CONTEXT, BASE_URL), null);
});

test("regression: repository/package metadata cannot fabricate source assurance or correspondence", () => {
  const resource = normalizeMcpRegistryEntry(
    {
      server: {
        name: "io.github.acme/widgets",
        description: "Widget MCP server.",
        version: "1.0.0",
        repository: { url: "https://github.com/acme/widgets", source: "github" },
        packages: [{ registryType: "npm", identifier: "widgets-mcp-server", version: "1.0.0" }],
      },
      _meta: {
        "io.modelcontextprotocol.registry/official": {
          status: "active",
          isLatest: true,
          // Forged/adjacent-looking fields an upstream response could in principle carry.
          verified: true,
          trustScore: 100,
          signatureVerified: true,
        },
      },
    },
    CONTEXT,
    BASE_URL,
  );
  assert.ok(resource !== null);
  assert.deepEqual(resource.trust, {
    sourceAssurance: { level: "NONE", evidenceRefs: [] },
    sourceInspection: { status: "NOT_RUN", exactCommitSha: null, sourceSnapshotSha256: null },
    correspondence: { status: "NOT_EVALUATED", publisherSha256: null, reproducedSha256: null },
    security: { status: "NOT_RUN", analysisKind: null, highestSeverity: null, findingCount: null },
    canonicalEvidence: { status: "NONE", sha256: null, verifiedAt: null, storageRoot: null, registryRecordId: null },
  });
  // The repository the Registry entry references is never promoted into a source claim: the
  // exact-commit/source-ref fields stay null even though `repository.url` is present upstream.
  assert.equal(resource.currentVersion?.source, null);
  assert.equal(resource.currentVersion?.distribution, null);
  assert.equal(resource.discovery.status, "INDEXED");
});

test("two different versions of the same server produce distinct stable version ids but the same resource id", () => {
  const v1 = normalizeMcpRegistryEntry({ server: { name: "io.github.acme/widgets", description: "x", version: "1.0.0" }, _meta: {} }, CONTEXT, BASE_URL);
  const v2 = normalizeMcpRegistryEntry({ server: { name: "io.github.acme/widgets", description: "x", version: "2.0.0" }, _meta: {} }, CONTEXT, BASE_URL);
  assert.ok(v1 !== null && v2 !== null);
  assert.equal(v1.id, v2.id);
  assert.equal(v1.id, "mcp-official-registry:io.github.acme/widgets");
  assert.notEqual(v1.currentVersion?.id, v2.currentVersion?.id);
});
