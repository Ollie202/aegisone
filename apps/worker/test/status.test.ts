import assert from "node:assert/strict";
import { test } from "node:test";
import { createWorkerStatus } from "../src/status.ts";

test("worker is healthy only when the long-term signer secret is configured", () => {
  assert.deepEqual(createWorkerStatus({}), {
    ok: false,
    service: "proofrail-worker",
    mode: "standby",
    signerConfigured: false,
    publicSigningEnabled: false,
    publishRouteEnabled: false,
    registryCommitmentEnabled: false,
  });

  assert.deepEqual(createWorkerStatus({ ZEROG_STORAGE_PRIVATE_KEY: "configured-secret" }), {
    ok: true,
    service: "proofrail-worker",
    mode: "standby",
    signerConfigured: true,
    publicSigningEnabled: false,
    publishRouteEnabled: false,
    registryCommitmentEnabled: false,
  });
});

test("the publication route reports enabled only when an internal token is configured", () => {
  // Fail closed: a signer alone never enables the route.
  assert.equal(createWorkerStatus({ ZEROG_STORAGE_PRIVATE_KEY: "k" }).publishRouteEnabled, false);
  // Whitespace is not a token.
  assert.equal(createWorkerStatus({ ZEROG_STORAGE_PRIVATE_KEY: "k", AEGISONE_WORKER_INTERNAL_TOKEN: "   " }).publishRouteEnabled, false);

  const enabled = createWorkerStatus({ ZEROG_STORAGE_PRIVATE_KEY: "k", AEGISONE_WORKER_INTERNAL_TOKEN: "t" });
  assert.equal(enabled.publishRouteEnabled, true);
  // Storage-only is a complete, valid mode; the chain commitment is separately configured.
  assert.equal(enabled.registryCommitmentEnabled, false);

  const withRegistry = createWorkerStatus({
    ZEROG_STORAGE_PRIVATE_KEY: "k",
    AEGISONE_WORKER_INTERNAL_TOKEN: "t",
    AEGISONE_REGISTRY_CONTRACT: "0x227Fcc243f25c395C93Df789EC72Bc75bf096017",
  });
  assert.equal(withRegistry.registryCommitmentEnabled, true);

  // A registry contract without an internal token still leaves everything disabled.
  assert.equal(
    createWorkerStatus({ ZEROG_STORAGE_PRIVATE_KEY: "k", AEGISONE_REGISTRY_CONTRACT: "0xabc" }).registryCommitmentEnabled,
    false,
  );
});

test("the health payload never contains a secret value", () => {
  const status = createWorkerStatus({
    ZEROG_STORAGE_PRIVATE_KEY: `0x${"a".repeat(64)}`,
    AEGISONE_WORKER_INTERNAL_TOKEN: "super-secret-internal-token",
    AEGISONE_REGISTRY_CONTRACT: "0x227Fcc243f25c395C93Df789EC72Bc75bf096017",
  });
  const serialized = JSON.stringify(status);
  assert.doesNotMatch(serialized, /a{64}/, "the signer key must never appear in the health payload");
  assert.doesNotMatch(serialized, /super-secret-internal-token/, "the internal token must never appear in the health payload");
  // Only booleans and the fixed service/mode strings are reported.
  for (const value of Object.values(status)) {
    assert.ok(
      typeof value === "boolean" || value === "proofrail-worker" || value === "standby",
      `health reports an unexpected value shape: ${String(value)}`,
    );
  }
});
