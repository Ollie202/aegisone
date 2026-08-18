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
  });

  assert.deepEqual(createWorkerStatus({ ZEROG_STORAGE_PRIVATE_KEY: "configured-secret" }), {
    ok: true,
    service: "proofrail-worker",
    mode: "standby",
    signerConfigured: true,
    publicSigningEnabled: false,
  });
});
