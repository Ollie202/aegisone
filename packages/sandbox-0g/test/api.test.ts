import assert from "node:assert/strict";
import test from "node:test";
import { Wallet, verifyMessage } from "ethers";
import { buildSignedHeaders, canonicalPayload, parseBrokerInfo, parseProviderListing, parseSandboxInfo, parseSnapshots, selectExecutionProvider } from "../src/api.ts";

const KEY = "0x59c6995e998f97a5a0044976f0945389dc9e86dae88c7a8412f4603b6b78690d";

const broker = {
  app_id: "0g-sandbox-broker",
  chain_id: 16602,
  contract_address: "0x3490B9053AC46F7Bf71A1ceBffcB2be2C1405b41",
  rpc_url: "https://evmrpc-testnet.0g.ai",
  tapp_registry: "0x2Ce80374318B1d7Fb3345724457a182E0ad165c9",
};

const providerListing = {
  address: "0xa19C4E672576E186AF81548E950Bf74A736220C3",
  url: "https://provider-private-sandbox.0g.ai",
  app_id: "0g-sandbox-provider",
  create_fee: "60000000000000000",
  price_per_cpu_per_min: "1000000000000000",
  price_per_mem_gb_per_min: "500000000000000",
};

const providerInfo = {
  app_id: "0g-sandbox-provider",
  chain_id: 16602,
  compute_price_per_sec: "166666666666666",
  contract_address: "0x3490B9053AC46F7Bf71A1ceBffcB2be2C1405b41",
  create_fee: "10000000000000000",
  min_balance: "19999999999999960",
  owner_address: "0xb831371eb2703305f1d9f8542163633d0675ced7",
  provider_address: "0xa19C4E672576E186AF81548E950Bf74A736220C3",
  rpc_url: "https://evmrpc-testnet.0g.ai",
  sealed_only: false,
  voucher_interval_sec: 60,
};

test("parses the live broker schema separately from provider schema", () => {
  const info = parseBrokerInfo(broker);
  assert.equal(info.chainId, 16602);
  assert.equal(info.appId, "0g-sandbox-broker");
  assert.equal(info.tappRegistry, "0x2Ce80374318B1d7Fb3345724457a182E0ad165c9");
});

test("parses live provider registry and provider info shapes", () => {
  const listing = parseProviderListing(providerListing);
  const info = parseSandboxInfo(providerInfo);
  assert.equal(listing.address, info.providerAddress);
  assert.equal(info.sealedOnly, false);
  assert.equal(info.minBalance, "19999999999999960");
  assert.equal(info.createFee, "10000000000000000");
});

test("selectExecutionProvider rejects sealed-only surfaces and chooses an active toolbox-capable snapshot", () => {
  const listing = parseProviderListing(providerListing);
  const nonSealed = parseSandboxInfo(providerInfo);
  const sealed = parseSandboxInfo({ ...providerInfo, provider_address: "0xd29Cb04A0ae8c85D639753Aba963CC3976D77FF3", sealed_only: true });
  const snapshots = parseSnapshots([{ id: "slim", name: "daytonaio/sandbox:0.5.0-slim", imageName: "daytonaio/sandbox:0.5.0-slim", state: "active", cpu: 1, mem: 1, disk: 3 }]);
  const selected = selectExecutionProvider([
    { listing: { ...listing, address: sealed.providerAddress }, info: sealed, snapshots },
    { listing, info: nonSealed, snapshots },
  ]);
  assert.equal(selected.info.providerAddress, listing.address);
  assert.equal(selected.snapshot.name, "daytonaio/sandbox:0.5.0-slim");
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
