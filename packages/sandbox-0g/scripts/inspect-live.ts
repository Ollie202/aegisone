import { formatEther, Wallet } from "ethers";
import { discoverBroker, discoverProvider, selectExecutionProvider } from "../src/api.ts";
import { inspectSandboxChain, normalizePrivateKey } from "../src/chain.ts";
import { getEvidence, summarizeEvidence } from "../src/tapp.ts";

const ARTIFACT_SHA256 = "9978d500ee45216cb6c93b886857100ce95b63f6135dd339ace7ff533d9aa154";
const privateKeyRaw = process.env.ZEROG_SANDBOX_PRIVATE_KEY?.trim();
if (!privateKeyRaw) throw new Error("ZEROG_SANDBOX_PRIVATE_KEY is required");

const wallet = new Wallet(normalizePrivateKey(privateKeyRaw));
const broker = await discoverBroker();
if (broker.info.chainId !== 16602) throw new Error(`Refusing non-Galileo broker chain ${broker.info.chainId}`);
const surfaces = await Promise.all(broker.providers.map(async (listing) => ({ listing, ...(await discoverProvider(listing)) })));
const selected = selectExecutionProvider(surfaces);
const chain = await inspectSandboxChain(selected.info, wallet.address);
const oneMinuteResourceCost = chain.servicePricePerCpuPerMin * BigInt(selected.snapshot.cpu ?? 1) + chain.servicePricePerMemGbPerMin * BigInt(selected.snapshot.mem ?? 1);
const requiredMinimum = chain.serviceCreateFee + oneMinuteResourceCost;
const enoughNativeForMinimum = chain.nativeBalance > requiredMinimum;
const challenge = Buffer.from(ARTIFACT_SHA256, "hex");
const evidence = summarizeEvidence(await getEvidence(chain.teeUrl, chain.appId, challenge), challenge, selected.info.providerAddress);

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
    onchainPricePerCpuPerMinWei: chain.servicePricePerCpuPerMin.toString(),
    onchainPricePerMemGbPerMinWei: chain.servicePricePerMemGbPerMin.toString(),
    oneMinuteResourceCostWei: oneMinuteResourceCost.toString(),
  },
  settlement: { contractAddress: selected.info.contractAddress, contractBalanceWei: chain.contractBalance.toString(), pendingRefundWei: chain.pendingRefund.toString(), refundUnlockAt: chain.refundUnlockAt.toString() },
  tapp: {
    registry: chain.tappRegistry,
    version: chain.tappVersion,
    acknowledged: chain.acknowledged,
    teeUrl: chain.teeUrl,
    nodeComposeHash: chain.nodeComposeHash,
    nodeVolumesHash: chain.nodeVolumesHash,
    evidence,
    artifactDigestChallengeBinding: evidence.challengeBindingProven ? "PROVEN" : "BLOCKED",
    artifactComputedInTee: "NOT_AVAILABLE_VIA_PUBLIC_TOOLBOX_FLOW",
  },
  preflight: { requiredMinimumWei: requiredMinimum.toString(), requiredMinimumOg: formatEther(requiredMinimum), enoughNativeForMinimum },
}, null, 2));

if (!enoughNativeForMinimum && chain.contractBalance < requiredMinimum) process.exitCode = 2;
if (!evidence.challengeBindingProven) process.exitCode = 3;
