import { formatEther, Wallet } from "ethers";
import { discoverBroker, discoverProvider, selectExecutionProvider } from "../src/api.ts";
import { inspectSandboxChain, normalizePrivateKey } from "../src/chain.ts";

const privateKeyRaw = process.env.ZEROG_SANDBOX_PRIVATE_KEY?.trim();
if (!privateKeyRaw) throw new Error("ZEROG_SANDBOX_PRIVATE_KEY is required");

const wallet = new Wallet(normalizePrivateKey(privateKeyRaw));
const broker = await discoverBroker();
if (broker.info.chainId !== 16602) throw new Error(`Refusing non-Galileo broker chain ${broker.info.chainId}`);

const surfaces = await Promise.all(broker.providers.map(async (listing) => ({ listing, ...(await discoverProvider(listing)) })));
const selected = selectExecutionProvider(surfaces);
const chain = await inspectSandboxChain(selected.info, wallet.address);
const requiredMinimum = BigInt(selected.info.minBalance ?? chain.serviceCreateFee.toString());
const enoughNativeForMinimum = chain.nativeBalance > requiredMinimum;

console.log(JSON.stringify({
  ok: true,
  readOnly: true,
  network: { chainId: broker.info.chainId, rpcUrl: broker.info.rpcUrl },
  wallet: { address: wallet.address, nativeBalanceWei: chain.nativeBalance.toString(), nativeBalanceOg: formatEther(chain.nativeBalance) },
  provider: {
    address: selected.info.providerAddress,
    url: selected.listing.url,
    appId: chain.appId,
    sealedOnly: selected.info.sealedOnly,
    snapshot: selected.snapshot,
    providerReportedCreateFeeWei: selected.info.createFee,
    providerReportedMinBalanceWei: selected.info.minBalance ?? null,
    onchainCreateFeeWei: chain.serviceCreateFee.toString(),
  },
  settlement: {
    contractAddress: selected.info.contractAddress,
    contractBalanceWei: chain.contractBalance.toString(),
    pendingRefundWei: chain.pendingRefund.toString(),
    refundUnlockAt: chain.refundUnlockAt.toString(),
  },
  tapp: { registry: chain.tappRegistry, acknowledged: chain.acknowledged, teeUrl: chain.teeUrl },
  preflight: { requiredMinimumWei: requiredMinimum.toString(), enoughNativeForMinimum },
}, null, 2));

if (!enoughNativeForMinimum && chain.contractBalance < requiredMinimum) process.exitCode = 2;
