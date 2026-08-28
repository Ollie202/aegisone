import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import { test } from "node:test";
import { handlePublishEvidence, constantTimeTokenMatches, bearerToken, type PublishRouteConfig } from "../src/publish-route.ts";
import { checkStoragePublicationIntegrity } from "../../../packages/evidence-publish/src/integrity.ts";
import type { StorageTransport, StorageUploadReceipt } from "../../../packages/storage-0g/src/types.ts";

/**
 * The worker's internal publication route, driven over real HTTP against a fake 0G transport.
 *
 * No live 0G call is made anywhere in this file, and no value here resembles a real recorded root,
 * transaction or record id.
 */

const TOKEN = "an-internal-token-with-plenty-of-entropy";
const TOKEN_SHA256 = createHash("sha256").update(TOKEN, "utf8").digest("hex");

class FakeStorage implements StorageTransport {
  uploads: Uint8Array[] = [];
  async chainId(): Promise<number> {
    return 16602;
  }
  async upload(bytes: Uint8Array): Promise<StorageUploadReceipt> {
    this.uploads.push(bytes);
    const root = `0x${createHash("sha256").update(bytes).digest("hex")}`;
    return { rootHashes: [root], transactionHashes: [`0x${"7".repeat(64)}`], transactionSequences: [1], locallyCalculatedRootHash: root };
  }
  async download(): Promise<Uint8Array> {
    return this.uploads.at(-1)!;
  }
}

function config(overrides: Partial<PublishRouteConfig> = {}): PublishRouteConfig {
  return {
    expectedTokenSha256: TOKEN_SHA256,
    storage: new FakeStorage(),
    network: { network: "0G Galileo Testnet", chainId: 16602 },
    registry: null,
    ...overrides,
  };
}

async function withServer(routeConfig: PublishRouteConfig, fn: (baseUrl: string) => Promise<void>): Promise<void> {
  const server: Server = createServer((request, response) => {
    void handlePublishEvidence(request, response, routeConfig).then((handled) => {
      if (!handled) {
        response.writeHead(404, { "content-type": "application/json" });
        response.end('{"error":"not_found"}\n');
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address !== null ? address.port : 0;
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

function validBody(): Record<string, unknown> {
  return {
    resourceVersionId: "version-1",
    artifactKind: "agent-skill",
    facts: {
      sourceInspectionStatus: "INSPECTED",
      sourceSnapshotSha256: "a".repeat(64),
      correspondenceStatus: "MATCH",
      publisherSha256: "b".repeat(64),
      reproducedSha256: "b".repeat(64),
      securityStatus: "COMPLETED",
      securityHighestSeverity: "INFO",
      securityFindingCount: 0,
      verifiedAt: "2026-08-28T12:00:00.000Z",
    },
    packageBase64: Buffer.from("SKILL.md body").toString("base64"),
    auditReport: { highestSeverity: "INFO", findings: [] },
  };
}

async function post(baseUrl: string, body: unknown, token: string | null): Promise<{ status: number; json: any }> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token !== null) headers.authorization = `Bearer ${token}`;
  const response = await fetch(`${baseUrl}/internal/publish-evidence`, {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  const text = await response.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: response.status, json };
}

test("an authorized publish returns real storage evidence that passes the integrity gate", async () => {
  const storage = new FakeStorage();
  const routeConfig = config({ storage });
  await withServer(routeConfig, async (baseUrl) => {
    const { status, json } = await post(baseUrl, validBody(), TOKEN);
    assert.equal(status, 200);
    assert.equal(json.ok, true);
    assert.match(json.storage.root, /^0x[0-9a-f]{64}$/);
    assert.equal(json.registry, null, "no registry configured means no chain commitment is claimed");

    // The row this response would produce must pass the same gate the Verified Library applies.
    const integrity = checkStoragePublicationIntegrity(
      {
        artifactKind: "agent-skill",
        resourceVersionId: "version-1",
        sourceInspectionStatus: "INSPECTED",
        sourceSnapshotSha256: "a".repeat(64),
        correspondenceStatus: "MATCH",
        publisherSha256: "b".repeat(64),
        reproducedSha256: "b".repeat(64),
        securityStatus: "COMPLETED",
        securityHighestSeverity: "INFO",
        securityFindingCount: 0,
        canonicalEvidenceSha256: json.canonicalEvidenceSha256,
        storageRoot: json.storage.root,
        storageTransaction: json.storage.transaction,
        registryContract: null,
        registryRecordId: null,
        registryTransaction: null,
        verifiedAt: "2026-08-28T12:00:00.000Z",
      },
      { network: "0G Galileo Testnet", chainId: 16602 },
    );
    assert.equal(integrity.ok, true, "a genuine worker publication must satisfy the app-side gate");
  });
});

test("an unauthenticated or wrongly-authenticated caller can never trigger a 0G write", async () => {
  const storage = new FakeStorage();
  await withServer(config({ storage }), async (baseUrl) => {
    for (const token of [null, "", "wrong-token", `${TOKEN}x`, TOKEN.slice(0, -1), TOKEN.toUpperCase()]) {
      const { status, json } = await post(baseUrl, validBody(), token);
      assert.equal(status, 401, `token ${JSON.stringify(token)} must be rejected`);
      assert.deepEqual(json, { error: "unauthorized" });
    }
    // The decisive assertion: not one byte reached the storage transport.
    assert.equal(storage.uploads.length, 0, "an unauthorized request must never reach 0G Storage");
  });
});

test("a non-Bearer authorization scheme is rejected", async () => {
  await withServer(config(), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/internal/publish-evidence`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Basic ${Buffer.from(TOKEN).toString("base64")}` },
      body: JSON.stringify(validBody()),
    });
    assert.equal(response.status, 401);
  });
});

test("the route rejects non-POST methods and ignores every other path", async () => {
  await withServer(config(), async (baseUrl) => {
    const get = await fetch(`${baseUrl}/internal/publish-evidence`, { method: "GET" });
    assert.equal(get.status, 405);

    for (const path of ["/", "/health", "/internal/sign", "/internal/publish-evidence/../sign", "/api/publish"]) {
      const response = await fetch(`${baseUrl}${path}`, { method: "POST", headers: { authorization: `Bearer ${TOKEN}` } });
      assert.equal(response.status, 404, `${path} must not be handled by the publication route`);
    }
  });
});

test("an authorized but malformed payload is rejected before any 0G work happens", async () => {
  const storage = new FakeStorage();
  await withServer(config({ storage }), async (baseUrl) => {
    const cases: unknown[] = [
      "not json at all",
      { ...validBody(), bytesToSign: `0x${"ab".repeat(32)}` },
      { ...validBody(), artifactKind: "container-image" },
      { ...validBody(), packageBase64: "" },
      { ...validBody(), facts: { ...(validBody().facts as object), correspondenceStatus: "DEFINITELY_FINE" } },
      { ...validBody(), facts: { ...(validBody().facts as object), reproducedSha256: null } },
    ];
    for (const body of cases) {
      const { status } = await post(baseUrl, body, TOKEN);
      assert.ok(status === 400 || status === 413, `malformed body must be rejected, got ${status}`);
    }
    assert.equal(storage.uploads.length, 0, "a malformed request must never reach 0G Storage");
  });
});

test("an oversized body is refused without being buffered into memory", async () => {
  const storage = new FakeStorage();
  await withServer(config({ storage }), async (baseUrl) => {
    const huge = { ...validBody(), packageBase64: Buffer.alloc(2 * 1024 * 1024, 0x41).toString("base64") };
    const { status } = await post(baseUrl, huge, TOKEN);
    assert.equal(status, 413);
    assert.equal(storage.uploads.length, 0);
  });
});

test("a 0G failure is reported as a failure, never as a synthesised success", async () => {
  const failing: StorageTransport = {
    async chainId() {
      return 16602;
    },
    async upload() {
      throw new Error("0G indexer unavailable");
    },
    async download() {
      throw new Error("unreachable");
    },
  };
  await withServer(config({ storage: failing }), async (baseUrl) => {
    const { status, json } = await post(baseUrl, validBody(), TOKEN);
    assert.equal(status, 502);
    assert.equal(json.error, "publication_failed");
    assert.equal(json.ok, undefined, "a failed publication must never report ok");
    assert.equal(json.storage, undefined, "a failed publication must never carry a storage root");
  });
});

test("token comparison is constant-time over hashed values and never throws on length mismatch", () => {
  assert.equal(constantTimeTokenMatches(TOKEN, TOKEN_SHA256), true);
  assert.equal(constantTimeTokenMatches("x", TOKEN_SHA256), false);
  // A raw token of wildly different length must simply return false, never throw.
  assert.equal(constantTimeTokenMatches("y".repeat(5000), TOKEN_SHA256), false);
  assert.equal(constantTimeTokenMatches(null, TOKEN_SHA256), false);
  assert.equal(constantTimeTokenMatches("", TOKEN_SHA256), false);
  // An unconfigured/invalid expected digest can never match anything — fail closed.
  assert.equal(constantTimeTokenMatches(TOKEN, ""), false);
  assert.equal(constantTimeTokenMatches(TOKEN, "not-a-digest"), false);
  assert.equal(constantTimeTokenMatches("", ""), false);
});

test("bearer extraction accepts only the Bearer scheme", () => {
  const header = (authorization?: string) => ({ headers: { authorization } }) as never;
  assert.equal(bearerToken(header(`Bearer ${TOKEN}`)), TOKEN);
  assert.equal(bearerToken(header(`bearer ${TOKEN}`)), TOKEN);
  assert.equal(bearerToken(header(`Basic ${TOKEN}`)), null);
  assert.equal(bearerToken(header(TOKEN)), null);
  assert.equal(bearerToken(header(undefined)), null);
});
