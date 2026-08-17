import assert from "node:assert/strict";
import test from "node:test";
import { normalizePrivateKey } from "../src/chain.ts";

test("normalizePrivateKey accepts exactly 32 bytes", () => {
  assert.equal(normalizePrivateKey("11".repeat(32)), `0x${"11".repeat(32)}`);
  assert.throws(() => normalizePrivateKey("11".repeat(31)), /32-byte hexadecimal/);
});
