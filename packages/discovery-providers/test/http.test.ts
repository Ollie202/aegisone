import assert from "node:assert/strict";
import { test } from "node:test";
import { DISCOVERY_PROVIDER_ALLOWED_ORIGINS } from "../src/constants.ts";
import { DiscoveryProviderError } from "../src/errors.ts";
import { postBoundedJson } from "../src/http.ts";
import { flakyThenOkFetch, jsonResponseFetch, neverRespondingFetch, redirectFetch, streamedOversizedFetch, textResponseFetch, throwingFetch } from "./test-fetch.ts";

const ORIGIN = "https://agentfinder.github.com";
const URL_ = `${ORIGIN}/api/v1/search`;

async function expectError(promise: Promise<unknown>, code: string): Promise<void> {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof DiscoveryProviderError);
    assert.equal(error.code, code);
    return true;
  });
}

test("rejects a call to any origin outside the fixed allowlist", async () => {
  await expectError(
    postBoundedJson({
      url: "https://not-allowlisted.example.test/search",
      body: {},
      allowedOrigins: DISCOVERY_PROVIDER_ALLOWED_ORIGINS,
      timeoutMs: 100,
      maxResponseBytes: 1024,
      signal: new AbortController().signal,
      fetchImpl: jsonResponseFetch({ results: [] }),
    }),
    "disallowed_origin",
  );
});

test("returns parsed JSON for a normal bounded response", async () => {
  const result = await postBoundedJson({
    url: URL_,
    body: { query: { text: "x" } },
    allowedOrigins: DISCOVERY_PROVIDER_ALLOWED_ORIGINS,
    timeoutMs: 1000,
    maxResponseBytes: 1024,
    signal: new AbortController().signal,
    fetchImpl: jsonResponseFetch({ results: [1, 2, 3] }),
  });
  assert.deepEqual(result, { results: [1, 2, 3] });
});

test("rejects when Content-Length declares a response larger than the byte cap", async () => {
  await expectError(
    postBoundedJson({
      url: URL_,
      body: {},
      allowedOrigins: DISCOVERY_PROVIDER_ALLOWED_ORIGINS,
      timeoutMs: 1000,
      maxResponseBytes: 10,
      signal: new AbortController().signal,
      fetchImpl: jsonResponseFetch({ results: ["this JSON body is much longer than ten bytes"] }),
    }),
    "response_too_large",
  );
});

test("rejects a streamed response exceeding the byte cap even without a Content-Length header", async () => {
  await expectError(
    postBoundedJson({
      url: URL_,
      body: {},
      allowedOrigins: DISCOVERY_PROVIDER_ALLOWED_ORIGINS,
      timeoutMs: 1000,
      maxResponseBytes: 100,
      signal: new AbortController().signal,
      fetchImpl: streamedOversizedFetch(5000),
    }),
    "response_too_large",
  );
});

test("rejects a malformed (non-JSON) response body", async () => {
  await expectError(
    postBoundedJson({
      url: URL_,
      body: {},
      allowedOrigins: DISCOVERY_PROVIDER_ALLOWED_ORIGINS,
      timeoutMs: 1000,
      maxResponseBytes: 1024,
      signal: new AbortController().signal,
      fetchImpl: textResponseFetch("not json at all {{{"),
    }),
    "malformed_response",
  );
});

test("blocks redirects instead of following them", async () => {
  await expectError(
    postBoundedJson({
      url: URL_,
      body: {},
      allowedOrigins: DISCOVERY_PROVIDER_ALLOWED_ORIGINS,
      timeoutMs: 1000,
      maxResponseBytes: 1024,
      signal: new AbortController().signal,
      fetchImpl: redirectFetch(),
    }),
    "redirect_blocked",
  );
});

test("treats a non-2xx upstream response as upstream_error", async () => {
  await expectError(
    postBoundedJson({
      url: URL_,
      body: {},
      allowedOrigins: DISCOVERY_PROVIDER_ALLOWED_ORIGINS,
      timeoutMs: 1000,
      maxResponseBytes: 1024,
      signal: new AbortController().signal,
      fetchImpl: jsonResponseFetch({ error: "boom" }, { status: 503 }),
    }),
    "upstream_error",
  );
});

test("aborts and reports timeout when the provider never responds", async () => {
  await expectError(
    postBoundedJson({
      url: URL_,
      body: {},
      allowedOrigins: DISCOVERY_PROVIDER_ALLOWED_ORIGINS,
      timeoutMs: 30,
      maxResponseBytes: 1024,
      signal: new AbortController().signal,
      fetchImpl: neverRespondingFetch(),
      allowRetry: false,
    }),
    "timeout",
  );
});

test("does not call the provider at all once the shared deadline has already elapsed", async () => {
  const controller = new AbortController();
  controller.abort();
  await expectError(
    postBoundedJson({
      url: URL_,
      body: {},
      allowedOrigins: DISCOVERY_PROVIDER_ALLOWED_ORIGINS,
      timeoutMs: 1000,
      maxResponseBytes: 1024,
      signal: controller.signal,
      fetchImpl: jsonResponseFetch({ results: [] }),
    }),
    "deadline_exceeded",
  );
});

test("retries at most once on a transient network error and then succeeds", async () => {
  const { fetchImpl, callCount } = flakyThenOkFetch({ results: [] });
  const result = await postBoundedJson({
    url: URL_,
    body: {},
    allowedOrigins: DISCOVERY_PROVIDER_ALLOWED_ORIGINS,
    timeoutMs: 1000,
    maxResponseBytes: 1024,
    signal: new AbortController().signal,
    fetchImpl,
    allowRetry: true,
  });
  assert.deepEqual(result, { results: [] });
  assert.equal(callCount(), 2);
});

test("does not retry beyond one attempt", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    throw new TypeError("always fails");
  };
  await expectError(
    postBoundedJson({
      url: URL_,
      body: {},
      allowedOrigins: DISCOVERY_PROVIDER_ALLOWED_ORIGINS,
      timeoutMs: 1000,
      maxResponseBytes: 1024,
      signal: new AbortController().signal,
      fetchImpl,
      allowRetry: true,
    }),
    "network_error",
  );
  assert.equal(calls, 2);
});

test("does not retry when allowRetry is false", async () => {
  await expectError(
    postBoundedJson({
      url: URL_,
      body: {},
      allowedOrigins: DISCOVERY_PROVIDER_ALLOWED_ORIGINS,
      timeoutMs: 1000,
      maxResponseBytes: 1024,
      signal: new AbortController().signal,
      fetchImpl: throwingFetch(),
      allowRetry: false,
    }),
    "network_error",
  );
});
