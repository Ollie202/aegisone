import assert from "node:assert/strict";
import test from "node:test";
import { normalizePrivateKey } from "../src/private-key.ts";
import { StorageRoundTripError } from "../src/types.ts";

const KEY_BODY = "ab".repeat(32);

test("private key normalization accepts standard exports with or without 0x", () => {
  assert.equal(normalizePrivateKey(KEY_BODY), `0x${KEY_BODY}`);
  assert.equal(normalizePrivateKey(`  0x${KEY_BODY}\n`), `0x${KEY_BODY}`);
  assert.equal(normalizePrivateKey(`"0x${KEY_BODY}"`), `0x${KEY_BODY}`);
  assert.equal(normalizePrivateKey(`ZEROG_STORAGE_PRIVATE_KEY=${KEY_BODY}`), `0x${KEY_BODY}`);
});

test("private key normalization rejects addresses, placeholders, and non-hex values", () => {
  for (const value of ["0x" + "ab".repeat(20), "REPLACE_ME", "zz".repeat(32)]) {
    assert.throws(
      () => normalizePrivateKey(value),
      (error: unknown) => error instanceof StorageRoundTripError && error.code === "INVALID_PRIVATE_KEY",
    );
  }
});

test("invalid-key diagnostics identify public addresses without exposing them", () => {
  const address = `0x${"ab".repeat(20)}`;
  assert.throws(
    () => normalizePrivateKey(address),
    (error: unknown) =>
      error instanceof StorageRoundTripError &&
      error.message.includes("public wallet address") &&
      !error.message.includes(address),
  );
});
