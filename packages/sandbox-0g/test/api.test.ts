import assert from "node:assert/strict";
import test from "node:test";
import { Wallet, verifyMessage } from "ethers";
import { buildSignedHeaders, canonicalPayload, parseSandboxInfo } from "../src/api.ts";

const KEY = "0x59c6995e998f97a5a0044976f0945389dc9e86dae88c7a8412f4603b6b78690d";

test("parseSandboxInfo accepts official snake_case shape", () => {
  const info = parseSandboxInfo({
    contract_address: "0x1111111111111111111111111111111111111111",
    provider_address: "0x2222222222222222222222222222222222222222",
    app_id: "sandbox-test",
    chain_id: 16602,
    rpc_url: "https://evmrpc-testnet.0g.ai",
    create_fee: "1",
    min_balance: "2",
    sealed_only: false,
  });
  assert.equal(info.chainId, 16602);
  assert.equal(info.appId, "sandbox-test");
  assert.equal(info.minBalance, "2");
});

test("signed headers recover the wallet and preserve official outer field order", async () => {
  const wallet = new Wallet(KEY);
  const headers = await buildSignedHeaders(wallet, "create", "", { z: 1, a: 2 }, { now: 1_700_000_000, nonce: "00".repeat(16) });
  const message = Buffer.from(headers["X-Signed-Message"], "base64").toString("utf8");
  assert.equal(message, '{"action":"create","expires_at":1700000180,"nonce":"00000000000000000000000000000000","payload":{"a":2,"z":1},"resource_id":""}');
  assert.equal(verifyMessage(message, headers["X-Wallet-Signature"]), wallet.address);
});

test("canonicalPayload recursively sorts object keys", () => {
  assert.deepEqual(canonicalPayload({ z: { y: 1, a: 2 }, a: 3 }), { a: 3, z: { a: 2, y: 1 } });
});
