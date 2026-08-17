import assert from "node:assert/strict";
import test from "node:test";
import { Interface } from "ethers";
import { TAPP_ABI } from "../src/chain.ts";

test("TappRegistry getNode ABI decodes current five-field NodeInfo", () => {
  const iface = new Interface(TAPP_ABI);
  const encoded = iface.encodeFunctionResult("getNode", [
    "https://tee.example",
    123n,
    456n,
    "0x1234",
    "0xabcd",
  ]);
  const decoded = iface.decodeFunctionResult("getNode", encoded);
  assert.equal(decoded.teeUrl, "https://tee.example");
  assert.equal(decoded.addedAt, 123n);
  assert.equal(decoded.stakeAmount, 456n);
  assert.equal(decoded.composeHash, "0x1234");
  assert.equal(decoded.volumesHash, "0xabcd");
});

test("TappRegistry ABI includes live version probe", () => {
  const iface = new Interface(TAPP_ABI);
  assert.ok(iface.getFunction("version"));
});
