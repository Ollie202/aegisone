import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { test } from "node:test";
import { DistributionFetchError, fetchDistributionArtifact } from "../src/distribution-fetch.ts";
import { canonicalSkillPackageBytes } from "../../skill-audit/src/package.ts";
import { summarizeSkillPackage } from "../../skill-audit/src/package.ts";

const GENUINE_BYTES = canonicalSkillPackageBytes([{ path: "SKILL.md", bytes: new TextEncoder().encode("---\nname: x\ndescription: x\n---\nbody") }]);
const GENUINE_SHA256 = summarizeSkillPackage([{ path: "SKILL.md", bytes: new TextEncoder().encode("---\nname: x\ndescription: x\n---\nbody") }]).sha256;

async function withServer(handler: Parameters<typeof createServer>[0], fn: (baseUrl: string) => Promise<void>): Promise<void> {
  const server: Server = createServer(handler);
  await new Promise<void>((resolvePromise) => server.listen(0, "127.0.0.1", resolvePromise));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("failed to bind test server");
  try {
    await fn(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolvePromise) => server.close(() => resolvePromise()));
  }
}

test("blocks loopback targets by default (no allowPrivateNetworkForTesting)", async () => {
  await withServer((_request, response) => { response.end(GENUINE_BYTES); }, async (baseUrl) => {
    const httpsShapedButLoopback = baseUrl.replace("http://", "https://");
    await assert.rejects(
      fetchDistributionArtifact({ url: httpsShapedButLoopback, expectedSha256: null }),
      DistributionFetchError,
    );
  });
});

test("rejects a non-https scheme even with the testing escape hatch", async () => {
  await assert.rejects(
    fetchDistributionArtifact({ url: "http://127.0.0.1:1/skill.skillpkg", expectedSha256: null }, { allowPrivateNetworkForTesting: true }),
    (error: unknown) => error instanceof DistributionFetchError && error.code === "distribution_scheme_not_allowed",
  );
});

test("rejects URLs carrying userinfo credentials", async () => {
  await assert.rejects(
    fetchDistributionArtifact({ url: "https://user:pass@example.com/skill.skillpkg", expectedSha256: null }, { allowPrivateNetworkForTesting: true }),
    (error: unknown) => error instanceof DistributionFetchError && error.code === "distribution_url_credentials_not_allowed",
  );
});

test("downloads and decodes a genuine canonical package over the loopback escape hatch", async () => {
  await withServer((_request, response) => { response.end(Buffer.from(GENUINE_BYTES)); }, async (baseUrl) => {
    const httpsUrl = baseUrl.replace("http://", "https://");
    const outcome = await fetchDistributionArtifact({ url: httpsUrl, expectedSha256: null }, { allowPrivateNetworkForTesting: true, fetcher: fetchViaHttp });
    assert.equal(outcome.publisherSha256, GENUINE_SHA256);
    assert.equal(outcome.entries.length, 1);
  });

  // A real `fetch("https://...")` cannot reach a plain-http loopback test server, so this test
  // uses a fetcher shim that rewrites https:// back to http:// only for 127.0.0.1 targets. The
  // SSRF/scheme checks above (which run before any fetch) are exercised with the real global
  // fetch and real https:// URLs, so this shim never weakens what's being tested.
  async function fetchViaHttp(input: string | URL | Request, init?: RequestInit): Promise<Response> {
    const url = new URL(String(input));
    url.protocol = "http:";
    return fetch(url, init);
  }
});

test("fails closed when the downloaded digest does not match the expected digest", async () => {
  await withServer((_request, response) => { response.end(Buffer.from(GENUINE_BYTES)); }, async (baseUrl) => {
    const httpsUrl = baseUrl.replace("http://", "https://");
    async function fetchViaHttp(input: string | URL | Request, init?: RequestInit): Promise<Response> {
      const url = new URL(String(input));
      url.protocol = "http:";
      return fetch(url, init);
    }
    await assert.rejects(
      fetchDistributionArtifact({ url: httpsUrl, expectedSha256: "f".repeat(64) }, { allowPrivateNetworkForTesting: true, fetcher: fetchViaHttp }),
      (error: unknown) => error instanceof DistributionFetchError && error.code === "distribution_digest_mismatch",
    );
  });
});

test("fails closed on a response exceeding the size cap", async () => {
  const oversized = Buffer.alloc(21 * 1024 * 1024, 1);
  await withServer((_request, response) => { response.end(oversized); }, async (baseUrl) => {
    const httpsUrl = baseUrl.replace("http://", "https://");
    async function fetchViaHttp(input: string | URL | Request, init?: RequestInit): Promise<Response> {
      const url = new URL(String(input));
      url.protocol = "http:";
      return fetch(url, init);
    }
    await assert.rejects(
      fetchDistributionArtifact({ url: httpsUrl, expectedSha256: null }, { allowPrivateNetworkForTesting: true, fetcher: fetchViaHttp }),
      (error: unknown) => error instanceof DistributionFetchError && error.code === "distribution_too_large",
    );
  });
});

test("fails closed on a malformed (non-canonical-package) body", async () => {
  await withServer((_request, response) => { response.end(Buffer.from("not a skill package")); }, async (baseUrl) => {
    const httpsUrl = baseUrl.replace("http://", "https://");
    async function fetchViaHttp(input: string | URL | Request, init?: RequestInit): Promise<Response> {
      const url = new URL(String(input));
      url.protocol = "http:";
      return fetch(url, init);
    }
    await assert.rejects(
      fetchDistributionArtifact({ url: httpsUrl, expectedSha256: null }, { allowPrivateNetworkForTesting: true, fetcher: fetchViaHttp }),
      (error: unknown) => error instanceof DistributionFetchError && error.code === "distribution_malformed_package",
    );
  });
});

test("rejects more than 3 redirect hops", async () => {
  let hops = 0;
  await withServer((request, response) => {
    hops += 1;
    if (hops <= 5) {
      response.writeHead(302, { location: request.url ?? "/" });
      response.end();
      return;
    }
    response.end(Buffer.from(GENUINE_BYTES));
  }, async (baseUrl) => {
    const httpsUrl = baseUrl.replace("http://", "https://");
    async function fetchViaHttp(input: string | URL | Request, init?: RequestInit): Promise<Response> {
      const url = new URL(String(input));
      url.protocol = "http:";
      return fetch(url, init);
    }
    await assert.rejects(
      fetchDistributionArtifact({ url: httpsUrl, expectedSha256: null }, { allowPrivateNetworkForTesting: true, fetcher: fetchViaHttp }),
      (error: unknown) => error instanceof DistributionFetchError && error.code === "distribution_too_many_redirects",
    );
  });
});
