import { readFile } from "node:fs/promises";
import {
  Contract,
  Interface,
  JsonRpcProvider,
  formatEther,
} from "ethers";

const RPC = "https://evmrpc.0g.ai";
const CHAIN_ID = 16661n;
const WALLET = "0x067Ac9bcb6B640bF65a0b17eeE705859c8292Dbb";
const CONTRACT = "0xeD2361a6B56dc0d4a7494F3a46BA47f352050BA4";
const RECORD_ID = "0xef2c77f9c39b77ce12328a404afcde9e935761a2d4fc9dfedff1f3b873f3ce4e";
const APPROVED_MAX_FEE_WEI = 2246628007863198n;
const SEARCH_FROM_BLOCK = 41915357;

const commitments = {
  manifestDigest: "0xb0ac39ac60df76f427311e3d1fce665b820b81a9c4b39481ce16843804419a54",
  sourceClaimDigest: "0xfcb0a23bcdf13648437b160e5a6dbc04b24f2399460c030753e194606e4e611a",
  publisherArtifactDigest: "0x9978d500ee45216cb6c93b886857100ce95b63f6135dd339ace7ff533d9aa154",
  reproducedArtifactDigest: "0x9978d500ee45216cb6c93b886857100ce95b63f6135dd339ace7ff533d9aa154",
  provenanceRoot: "0xc727fe83637fa9e323c84f2f7507599c9778cc9081a5b762cf5ba4fd54bdf181",
} as const;

function sameHex(left: unknown, right: string): boolean {
  return String(left).toLowerCase() === right.toLowerCase();
}

function hexBlock(blockNumber: number): string {
  return `0x${blockNumber.toString(16)}`;
}

const provider = new JsonRpcProvider(RPC);
const network = await provider.getNetwork();
if (network.chainId !== CHAIN_ID) {
  throw new Error(`Unexpected Aristotle chain ID ${network.chainId.toString()}`);
}

const artifact = JSON.parse(
  await readFile("contracts/artifacts/src/AegisOneRegistry.sol/AegisOneRegistry.json", "utf8"),
) as { abi: unknown[] };

const code = await provider.getCode(CONTRACT);
if (code === "0x") throw new Error("Expected AegisOneRegistry contract has no code");

const registry = new Contract(CONTRACT, artifact.abi, provider);
if (!(await registry.exists(RECORD_ID))) throw new Error("Expected M5 registry record does not exist");
const stored = await registry.getEvidence(RECORD_ID);

const readbackMatches =
  sameHex(stored.manifestDigest, commitments.manifestDigest) &&
  sameHex(stored.sourceClaimDigest, commitments.sourceClaimDigest) &&
  sameHex(stored.publisherArtifactDigest, commitments.publisherArtifactDigest) &&
  sameHex(stored.reproducedArtifactDigest, commitments.reproducedArtifactDigest) &&
  sameHex(stored.provenanceRoot, commitments.provenanceRoot) &&
  sameHex(stored.submitter, WALLET);
if (!readbackMatches) throw new Error("Aristotle registry read-back does not match approved M5 commitments");

const iface = new Interface(artifact.abi);
const event = iface.getEvent("EvidenceRegistered");
if (!event) throw new Error("EvidenceRegistered event missing from registry ABI");
const latestBlock = await provider.getBlockNumber();
const logs = await provider.getLogs({
  address: CONTRACT,
  fromBlock: SEARCH_FROM_BLOCK,
  toBlock: latestBlock,
  topics: [event.topicHash, RECORD_ID],
});
if (logs.length !== 1) {
  throw new Error(`Expected exactly one M5 EvidenceRegistered log, found ${logs.length}`);
}

const registrationLog = logs[0];
const registrationTx = await provider.getTransaction(registrationLog.transactionHash);
const registrationReceipt = await provider.getTransactionReceipt(registrationLog.transactionHash);
if (!registrationTx || !registrationReceipt || registrationReceipt.status !== 1) {
  throw new Error("M5 registration transaction/receipt is missing or unsuccessful");
}
if (!sameHex(registrationTx.from, WALLET) || registrationTx.nonce !== 1 || !sameHex(registrationTx.to, CONTRACT)) {
  throw new Error("M5 registration transaction identity/nonce/target mismatch");
}

let deploymentTxHash: string | null = null;
const registrationBlock = registrationReceipt.blockNumber;
const firstCandidateBlock = Math.max(0, registrationBlock - 50);
for (let blockNumber = registrationBlock; blockNumber >= firstCandidateBlock && deploymentTxHash === null; blockNumber -= 1) {
  const block = await provider.send("eth_getBlockByNumber", [hexBlock(blockNumber), true]) as {
    transactions: Array<{ hash: string; from: string; to: string | null; nonce: string }>;
  };
  for (const tx of block.transactions) {
    const nonce = Number.parseInt(tx.nonce, 16);
    if (sameHex(tx.from, WALLET) && nonce === 0 && tx.to === null) {
      deploymentTxHash = tx.hash;
      break;
    }
  }
}
if (!deploymentTxHash) throw new Error("Could not locate nonce-0 AegisOneRegistry deployment transaction");

const deploymentTx = await provider.getTransaction(deploymentTxHash);
const deploymentReceipt = await provider.getTransactionReceipt(deploymentTxHash);
if (!deploymentTx || !deploymentReceipt || deploymentReceipt.status !== 1) {
  throw new Error("AegisOneRegistry deployment transaction/receipt is missing or unsuccessful");
}
if (!sameHex(deploymentTx.from, WALLET) || deploymentTx.nonce !== 0 || deploymentTx.to !== null) {
  throw new Error("AegisOneRegistry deployment transaction identity/nonce mismatch");
}
if (!sameHex(deploymentReceipt.contractAddress, CONTRACT)) {
  throw new Error(`Deployment receipt contract ${deploymentReceipt.contractAddress} does not match expected ${CONTRACT}`);
}

const deploymentFeeWei = deploymentReceipt.gasUsed * deploymentReceipt.gasPrice;
const registrationFeeWei = registrationReceipt.gasUsed * registrationReceipt.gasPrice;
const totalFeeWei = deploymentFeeWei + registrationFeeWei;
if (totalFeeWei > APPROVED_MAX_FEE_WEI) {
  throw new Error(`Actual fee ${totalFeeWei.toString()} exceeds approved cap ${APPROVED_MAX_FEE_WEI.toString()}`);
}

const endingBalanceWei = await provider.getBalance(WALLET);

console.log(JSON.stringify({
  schemaVersion: "1",
  kind: "AegisOneAristotleMainnetVerification",
  verifiedAtBlock: latestBlock,
  network: {
    name: "0G Mainnet / Aristotle",
    chainId: Number(CHAIN_ID),
    rpc: RPC,
  },
  wallet: {
    address: WALLET,
    currentNonce: await provider.getTransactionCount(WALLET, "latest"),
    balanceWei: endingBalanceWei.toString(),
    balance0G: formatEther(endingBalanceWei),
  },
  contract: {
    address: CONTRACT,
    codePresent: true,
    deploymentTransactionHash: deploymentTxHash,
    deploymentBlock: deploymentReceipt.blockNumber,
    deploymentGasUsed: deploymentReceipt.gasUsed.toString(),
    deploymentGasPriceWei: deploymentReceipt.gasPrice.toString(),
    deploymentFeeWei: deploymentFeeWei.toString(),
    deploymentFee0G: formatEther(deploymentFeeWei),
  },
  registration: {
    recordId: RECORD_ID,
    transactionHash: registrationReceipt.hash,
    blockNumber: registrationReceipt.blockNumber,
    gasUsed: registrationReceipt.gasUsed.toString(),
    gasPriceWei: registrationReceipt.gasPrice.toString(),
    feeWei: registrationFeeWei.toString(),
    fee0G: formatEther(registrationFeeWei),
    registeredAt: stored.registeredAt.toString(),
    submitter: stored.submitter,
    readbackMatches: true,
    commitments,
  },
  cost: {
    approvedMaxFeeWei: APPROVED_MAX_FEE_WEI.toString(),
    approvedMaxFee0G: formatEther(APPROVED_MAX_FEE_WEI),
    actualTotalFeeWei: totalFeeWei.toString(),
    actualTotalFee0G: formatEther(totalFeeWei),
    withinApprovedCap: true,
  },
  explorer: {
    contract: `https://chainscan.0g.ai/address/${CONTRACT}`,
    deploymentTransaction: `https://chainscan.0g.ai/tx/${deploymentTxHash}`,
    registrationTransaction: `https://chainscan.0g.ai/tx/${registrationReceipt.hash}`,
  },
  status: "VERIFIED",
}, null, 2));
