import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import { test } from "node:test";
import { InMemoryJobStore } from "../../../packages/job-store/src/index.ts";
import { InMemoryCatalogStore } from "../../../packages/catalog-store/src/index.ts";
import { FixedWindowRateLimiter } from "../src/rate-limit.ts";
import { buildCanonicalEvidenceManifest, type PublicationEvidenceFacts } from "../../../packages/evidence-publish/src/index.ts";
import { createProductRequestHandler, type ProductHandlerOptions } from "../src/product.ts";
import type { PublishTriggerConfig, WorkerPublishResponse } from "../src/publish-trigger.ts";

/**
 * `POST /api/v1/publish` — the app-side operator trigger.
 *
 * The worker is never contacted: `callPublishWorker` is injected, so this exercises the whole
 * authorization / rate-limit / persistence path with zero 0G spend and no network. The "storage
 * root" the fake worker returns is an obviously synthetic test value.
 */

const OPERATOR_TOKEN = "operator-token-with-adequate-entropy";
const OPERATOR_TOKEN_SHA256 = createHash("sha256").update(OPERATOR_TOKEN, "utf8").digest("hex");

const FULL_CONFIG: PublishTriggerConfig = {
  operatorTokenSha256: OPERATOR_TOKEN_SHA256,
  workerBaseUrl: "https://worker.invalid",
  workerInternalToken: "worker-internal-token",
};

interface Harness {
  baseUrl: string;
  server: Server;
  calls: unknown[];
}

async function startServer(overrides: Partial<ProductHandlerOptions> = {}, calls: unknown[] = []): Promise<Harness> {
  const handler = createProductRequestHandler(new InMemoryJobStore(), {
    publicBaseUrl: "https://aegisone.example",
    catalogStore: new InMemoryCatalogStore(),
    githubSourceAuthConfig: null,
    secureSourceAuthCookies: false,
    publishConfig: FULL_CONFIG,
    publishRateLimiter: new FixedWindowRateLimiter(5, 60 * 60 * 1000),
    callPublishWorker: async (body): Promise<WorkerPublishResponse> => {
      calls.push(body);
      const facts = (body as { facts: Record<string, unknown>; resourceVersionId: string });
      const publicationFacts: PublicationEvidenceFacts = {
        artifactKind: "agent-skill",
        resourceVersionId: facts.resourceVersionId,
        sourceInspectionStatus: facts.facts.sourceInspectionStatus as never,
        sourceSnapshotSha256: facts.facts.sourceSnapshotSha256 as never,
        correspondenceStatus: facts.facts.correspondenceStatus as never,
        publisherSha256: facts.facts.publisherSha256 as never,
        reproducedSha256: facts.facts.reproducedSha256 as never,
        securityStatus: facts.facts.securityStatus as never,
        securityHighestSeverity: facts.facts.securityHighestSeverity as never,
        securityFindingCount: facts.facts.securityFindingCount as never,
        verifiedAt: facts.facts.verifiedAt as string,
      };
      const storage = {
        network: "0G Galileo Testnet",
        chainId: 16602,
        root: `0x${"5a".repeat(32)}`,
        transaction: `0x${"6b".repeat(32)}`,
      };
      const manifest = buildCanonicalEvidenceManifest(publicationFacts, storage);
      return {
        ok: true,
        resourceVersionId: facts.resourceVersionId,
        canonicalEvidenceSha256: manifest.sha256,
        storage,
        registry: null,
        registryError: null,
        bundleByteLength: 1234,
      };
    },
    ...overrides,
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
  if (address === null || typeof address === "string") throw new Error("no port");
  return { baseUrl: `http://127.0.0.1:${address.port}`, server, calls };
}

async function stop(server: Server): Promise<void> {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

async function publish(baseUrl: string, body: unknown, token: string | null): Promise<{ status: number; json: any }> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token !== null) headers.authorization = `Bearer ${token}`;
  const response = await fetch(`${baseUrl}/api/v1/publish`, { method: "POST", headers, body: JSON.stringify(body) });
  const text = await response.text();
  let json: unknown = text;
  try {
    json = JSON.parse(text);
  } catch {
    /* keep raw */
  }
  return { status: response.status, json };
}

/**
 * The catalog store assigns its own UUID to each seeded resource, so tests discover a real id at
 * runtime rather than hardcoding one. Hitting `/verified` also forces the lazy library seed, which
 * is exactly the state a real deployment is in by the time anyone publishes.
 */
async function seededResourceId(baseUrl: string): Promise<string> {
  const html = await (await fetch(`${baseUrl}/verified`)).text();
  const match = /\/resources\/([0-9a-f-]{36})/.exec(html);
  assert.ok(match, "expected the seeded library to expose at least one resource");
  return match[1]!;
}

test("an anonymous caller can never trigger a funded 0G publication", async () => {
  const calls: unknown[] = [];
  const { baseUrl, server } = await startServer({}, calls);
  try {
    const resourceId = await seededResourceId(baseUrl);
    for (const token of [null, "", "wrong", `${OPERATOR_TOKEN}x`, OPERATOR_TOKEN.slice(0, -1)]) {
      const { status, json } = await publish(baseUrl, { resourceId }, token);
      assert.equal(status, 401, `token ${JSON.stringify(token)} must be rejected`);
      assert.equal(json.error, "unauthorized");
    }
    assert.equal(calls.length, 0, "an unauthorized request must never reach the worker");
  } finally {
    await stop(server);
  }
});

test("the publish route does not exist at all when publication is unconfigured", async () => {
  for (const config of [
    { operatorTokenSha256: null, workerBaseUrl: "https://w.invalid", workerInternalToken: "t" },
    { operatorTokenSha256: OPERATOR_TOKEN_SHA256, workerBaseUrl: null, workerInternalToken: "t" },
    { operatorTokenSha256: OPERATOR_TOKEN_SHA256, workerBaseUrl: "https://w.invalid", workerInternalToken: null },
  ] satisfies PublishTriggerConfig[]) {
    const calls: unknown[] = [];
    const { baseUrl, server } = await startServer({ publishConfig: config }, calls);
    try {
      // 404, not 401: an unconfigured deployment has no funded endpoint to authenticate against.
      const { status } = await publish(baseUrl, { resourceId: await seededResourceId(baseUrl) }, OPERATOR_TOKEN);
      assert.equal(status, 404, "an unconfigured publish route must not exist");
      assert.equal(calls.length, 0);
    } finally {
      await stop(server);
    }
  }
});

test("an authorized publish persists a row that passes the integrity gate and surfaces as STORED ON 0G", async () => {
  const calls: unknown[] = [];
  const { baseUrl, server } = await startServer({}, calls);
  try {
    const resourceId = await seededResourceId(baseUrl);
    const { status, json } = await publish(baseUrl, { resourceId }, OPERATOR_TOKEN);
    assert.equal(status, 200, JSON.stringify(json));
    assert.equal(calls.length, 1, "exactly one worker call");

    // The worker was given the REAL package bytes, not a placeholder.
    const call = calls[0] as { packageBase64: string; artifactKind: string };
    assert.equal(call.artifactKind, "agent-skill");
    assert.ok(Buffer.from(call.packageBase64, "base64").byteLength > 0, "real package bytes must be sent");

    // And the persisted row now passes the gate on the public read path.
    const api = await (await fetch(`${baseUrl}/api/v1/resources/${encodeURIComponent(resourceId)}`)).json();
    assert.equal(api.integrity.storagePublication.ok, true);
    assert.equal(api.resource.trust.canonicalEvidence.storageRoot, json.storage.root);

    const library = await (await fetch(`${baseUrl}/verified`)).text();
    assert.ok(library.includes(json.storage.root), "the published root appears in the library");
    assert.match(library, /STORED ON 0G/);
  } finally {
    await stop(server);
  }
});

test("publication never mutates a prior verdict — it appends a new verification row", async () => {
  const { baseUrl, server } = await startServer();
  try {
    const resourceId = await seededResourceId(baseUrl);
    const before = await (await fetch(`${baseUrl}/api/v1/resources/${encodeURIComponent(resourceId)}/evidence`)).json();
    const countBefore = before.capabilityVerifications.length;

    await publish(baseUrl, { resourceId }, OPERATOR_TOKEN);

    const after = await (await fetch(`${baseUrl}/api/v1/resources/${encodeURIComponent(resourceId)}/evidence`)).json();
    assert.equal(after.capabilityVerifications.length, countBefore + 1, "a publication appends, never overwrites");
    // The correspondence verdict is carried forward unchanged — publishing does not upgrade it.
    assert.equal(
      after.capabilityVerifications[0].correspondenceStatus,
      before.capabilityVerifications[0].correspondenceStatus,
      "publishing must never change a correspondence verdict",
    );
  } finally {
    await stop(server);
  }
});

test("publishing refuses a resource whose exact bytes AegisOne does not hold", async () => {
  const calls: unknown[] = [];
  const { baseUrl, server } = await startServer({}, calls);
  try {
    const { status, json } = await publish(baseUrl, { resourceId: "does-not-exist:anything" }, OPERATOR_TOKEN);
    assert.equal(status, 404);
    assert.equal(json.error, "resource_not_found");
    assert.equal(calls.length, 0, "no worker call for a resource that does not exist");
  } finally {
    await stop(server);
  }
});

test("the publication route is rate limited independently of every other route", async () => {
  const calls: unknown[] = [];
  const { baseUrl, server } = await startServer(
    { publishRateLimiter: new FixedWindowRateLimiter(2, 60 * 60 * 1000) },
    calls,
  );
  try {
    const resourceId = await seededResourceId(baseUrl);
    assert.equal((await publish(baseUrl, { resourceId }, OPERATOR_TOKEN)).status, 200);
    assert.equal((await publish(baseUrl, { resourceId }, OPERATOR_TOKEN)).status, 200);
    const third = await publish(baseUrl, { resourceId }, OPERATOR_TOKEN);
    assert.equal(third.status, 429, "the third publication in the window must be refused");
    assert.equal(third.json.error, "rate_limited");
    assert.equal(calls.length, 2, "a rate-limited request must never reach the worker");

    // Free read traffic is unaffected — the limiters are genuinely separate.
    assert.equal((await fetch(`${baseUrl}/verified`)).status, 200);
    assert.equal((await fetch(`${baseUrl}/`)).status, 200);
  } finally {
    await stop(server);
  }
});

test("an unauthorized request does not consume the operator's rate-limit budget", async () => {
  const calls: unknown[] = [];
  const { baseUrl, server } = await startServer(
    { publishRateLimiter: new FixedWindowRateLimiter(1, 60 * 60 * 1000) },
    calls,
  );
  try {
    // Authorization is checked BEFORE the limiter, so this must not burn the single slot.
    const resourceId = await seededResourceId(baseUrl);
    assert.equal((await publish(baseUrl, { resourceId }, "wrong")).status, 401);
    assert.equal((await publish(baseUrl, { resourceId }, OPERATOR_TOKEN)).status, 200);
  } finally {
    await stop(server);
  }
});

test("a malformed publish request is rejected without reaching the worker", async () => {
  const calls: unknown[] = [];
  const { baseUrl, server } = await startServer({}, calls);
  try {
    for (const body of [{}, { resourceId: "" }, { resourceId: 42 }, { notAResourceId: "x" }]) {
      const { status } = await publish(baseUrl, body, OPERATOR_TOKEN);
      assert.equal(status, 400, `body ${JSON.stringify(body)} must be rejected`);
    }
    assert.equal(calls.length, 0);
  } finally {
    await stop(server);
  }
});

test("a worker refusal is surfaced as a failure and persists no publication", async () => {
  const { baseUrl, server } = await startServer({
    callPublishWorker: async () => {
      throw new Error("worker said no");
    },
  });
  try {
    const resourceId = await seededResourceId(baseUrl);
    const { status } = await publish(baseUrl, { resourceId }, OPERATOR_TOKEN);
    assert.ok(status >= 400, "a worker failure must not report success");

    const api = await (await fetch(`${baseUrl}/api/v1/resources/${encodeURIComponent(resourceId)}`)).json();
    assert.equal(api.resource.trust.canonicalEvidence.storageRoot, null, "a failed publication stores no root");
  } finally {
    await stop(server);
  }
});

test("a worker claiming a different network is refused rather than persisted", async () => {
  const { baseUrl, server } = await startServer({
    callPublishWorker: async (body): Promise<WorkerPublishResponse> => ({
      ok: true,
      resourceVersionId: (body as { resourceVersionId: string }).resourceVersionId,
      canonicalEvidenceSha256: "a".repeat(64),
      // Aristotle mainnet, not the Galileo network this app validates against.
      storage: { network: "0G Aristotle Mainnet", chainId: 16661, root: `0x${"7c".repeat(32)}`, transaction: `0x${"8d".repeat(32)}` },
      registry: null,
      registryError: null,
      bundleByteLength: 10,
    }),
  });
  try {
    const { status, json } = await publish(baseUrl, { resourceId: await seededResourceId(baseUrl) }, OPERATOR_TOKEN);
    assert.equal(status, 502);
    assert.equal(json.error, "network_mismatch");
  } finally {
    await stop(server);
  }
});
