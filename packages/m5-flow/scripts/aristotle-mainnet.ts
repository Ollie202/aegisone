import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  AbiCoder,
  Contract,
  ContractFactory,
  JsonRpcProvider,
  Wallet,
  formatEther,
  getCreateAddress,
  keccak256,
} from "ethers";

const RPC = "https://evmrpc.0g.ai";
const CHAIN_ID = 16661n;
const EXPECTED_SIGNER = "0x067Ac9bcb6B640bF65a0b17eeE705859c8292Dbb";
const EXPECTED_NONCE = 0;
const EXPECTED_CONTRACT = "0xeD2361a6B56dc0d4a7494F3a46BA47f352050BA4";
const EXPECTED_BYTECODE_KECCAK256 = "0x25e077f4adb8082bfb85b28ee7f90d0257b6f96fbfd79a529d65815960cdd0cd";
const EXPECTED_RECORD_ID = "0xef2c77f9c39b77ce12328a404afcde9e935761a2d4fc9dfedff1f3b873f3ce4e";
const EXPECTED_CALLDATA_KECCAK256 = "0x9312e036d22d405998b17325cba4039c6bbddf0259189fe998e12838927b15be";
const DEPLOY_GAS_LIMIT = 368309n;
const REGISTER_GAS_LIMIT = 193348n;
const TOTAL_GAS_LIMIT = DEPLOY_GAS_LIMIT + REGISTER_GAS_LIMIT;
const APPROVED_MAX_FEE_WEI = 2246628007863198n;
const EXECUTION_TOKEN = "APPROVED_M5_ARISTOTLE_2026_08_17";

const commitments = {
  manifestDigest: "0xb0ac39ac60df76f427311e3d1fce665b820b81a9c4b39481ce16843804419a54",
  sourceClaimDigest: "0xfcb0a23bcdf13648437b160e5a6dbc04b24f2399460c030753e194606e4e611a",
  publisherArtifactDigest: "0x9978d500ee45216cb6c93b886857100ce95b63f6135dd339ace7ff533d9aa154",
  reproducedArtifactDigest: "0x9978d500ee45216cb6c93b886857100ce95b63f6135dd339ace7ff533d9aa154",
  provenanceRoot: "0xc727fe83637fa9e323c84f2f7507599c9778cc9081a5b762cf5ba4fd54bdf181",
} as const;

interface HardhatArtifact {
  abi: unknown[];
  bytecode: string;
}

function normalizePrivateKey(value: string): string {
  let trimmed = value.trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    trimmed = trimmed.slice(1, -1).trim();
  }
  for (const prefix of [
    "ZEROG_SANDBOX_PRIVATE_KEY=",
    "ZEROG_REGISTRY_PRIVATE_KEY=",
    "ZEROG_STORAGE_PRIVATE_KEY=",
  ]) {
    if (trimmed.startsWith(prefix)) trimmed = trimmed.slice(prefix.length).trim();
  }
  const normalized = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new TypeError("Aristotle signer must be a 32-byte hexadecimal private key");
  }
  return normalized;
}

function sameHex(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

function minBigInt(left: bigint, right: bigint): bigint {
  return left < right ? left : right;
}

async function main(): Promise<void> {
  const keyRaw =
    process.env.ZEROG_SANDBOX_PRIVATE_KEY?.trim() ??
    process.env.ZEROG_REGISTRY_PRIVATE_KEY?.trim() ??
    process.env.ZEROG_STORAGE_PRIVATE_KEY?.trim();
  if (!keyRaw) throw new Error("A funded Aristotle signer key is required");

  const provider = new JsonRpcProvider(RPC);
  const network = await provider.getNetwork();
  if (network.chainId !== CHAIN_ID) {
    throw new Error(`Refusing unexpected chain ID ${network.chainId.toString()}`);
  }

  const signer = new Wallet(normalizePrivateKey(keyRaw), provider);
  if (!sameHex(signer.address, EXPECTED_SIGNER)) {
    throw new Error(`Refusing signer ${signer.address}; expected ${EXPECTED_SIGNER}`);
  }

  const artifactPath = resolve(
    import.meta.dirname,
    "../../../contracts/artifacts/src/ProofRailRegistry.sol/ProofRailRegistry.json",
  );
  const artifact = JSON.parse(await readFile(artifactPath, "utf8")) as HardhatArtifact;
  if (!artifact.bytecode.startsWith("0x") || artifact.bytecode.length <= 2) {
    throw new Error("Compiled ProofRailRegistry bytecode is missing");
  }
  if (!sameHex(keccak256(artifact.bytecode), EXPECTED_BYTECODE_KECCAK256)) {
    throw new Error("Refusing unexpected ProofRailRegistry deployment bytecode");
  }

  const registryInterface = new Contract(EXPECTED_CONTRACT, artifact.abi).interface;
  const registrationCalldata = registryInterface.encodeFunctionData("registerEvidence", [
    commitments.manifestDigest,
    commitments.sourceClaimDigest,
    commitments.publisherArtifactDigest,
    commitments.reproducedArtifactDigest,
    commitments.provenanceRoot,
  ]);
  if (!sameHex(keccak256(registrationCalldata), EXPECTED_CALLDATA_KECCAK256)) {
    throw new Error("Refusing unexpected M5 registration calldata");
  }
  const recordId = keccak256(
    AbiCoder.defaultAbiCoder().encode(
      ["bytes32", "bytes32", "bytes32", "bytes32", "bytes32"],
      [
        commitments.manifestDigest,
        commitments.sourceClaimDigest,
        commitments.publisherArtifactDigest,
        commitments.reproducedArtifactDigest,
        commitments.provenanceRoot,
      ],
    ),
  );
  if (!sameHex(recordId, EXPECTED_RECORD_ID)) {
    throw new Error(`Refusing unexpected record ID ${recordId}`);
  }

  const [blockNumber, nonce, pendingNonce, balanceWei, feeData] = await Promise.all([
    provider.getBlockNumber(),
    provider.getTransactionCount(signer.address, "latest"),
    provider.getTransactionCount(signer.address, "pending"),
    provider.getBalance(signer.address),
    provider.getFeeData(),
  ]);
  if (nonce !== EXPECTED_NONCE || pendingNonce !== EXPECTED_NONCE) {
    throw new Error(`Refusing nonce latest=${nonce}, pending=${pendingNonce}; expected 0`);
  }

  const predicted = getCreateAddress({ from: signer.address, nonce });
  if (!sameHex(predicted, EXPECTED_CONTRACT)) {
    throw new Error(`Refusing predicted contract ${predicted}; expected ${EXPECTED_CONTRACT}`);
  }
  if ((await provider.getCode(EXPECTED_CONTRACT)) !== "0x") {
    throw new Error("Refusing deployment because the predicted registry address already has code");
  }

  const feeBasisWei = feeData.maxFeePerGas ?? feeData.gasPrice;
  if (feeBasisWei === null) throw new Error("Aristotle RPC returned no usable fee basis");
  const worstCaseFeeWei = TOTAL_GAS_LIMIT * feeBasisWei;
  if (worstCaseFeeWei > APPROVED_MAX_FEE_WEI) {
    throw new Error(
      `Refusing fee envelope ${worstCaseFeeWei.toString()} wei; approval cap is ${APPROVED_MAX_FEE_WEI.toString()} wei`,
    );
  }
  if (balanceWei < worstCaseFeeWei) {
    throw new Error("Aristotle signer balance is insufficient for the approved transaction envelope");
  }

  const execute = process.env.PROOFRAIL_ARISTOTLE_EXECUTE === EXECUTION_TOKEN;
  const common = {
    schemaVersion: "1",
    network: "0G Mainnet / Aristotle",
    chainId: Number(CHAIN_ID),
    rpc: RPC,
    checkedBlock: blockNumber,
    signerAddress: signer.address,
    nonce,
    balance0G: formatEther(balanceWei),
    contractAddress: EXPECTED_CONTRACT,
    recordId: EXPECTED_RECORD_ID,
    commitments,
    approvedMaxFeeWei: APPROVED_MAX_FEE_WEI.toString(),
    approvedMaxFee0G: formatEther(APPROVED_MAX_FEE_WEI),
    currentWorstCaseFeeWei: worstCaseFeeWei.toString(),
    currentWorstCaseFee0G: formatEther(worstCaseFeeWei),
    gasLimits: {
      deployment: DEPLOY_GAS_LIMIT.toString(),
      registration: REGISTER_GAS_LIMIT.toString(),
      total: TOTAL_GAS_LIMIT.toString(),
    },
  };

  if (!execute) {
    process.stdout.write(JSON.stringify({ ...common, status: "DRY_RUN_GUARDS_PASSED", mainnetWrites: false }, null, 2) + "\n");
    return;
  }

  const [finalPendingNonce, finalFeeData] = await Promise.all([
    provider.getTransactionCount(signer.address, "pending"),
    provider.getFeeData(),
  ]);
  if (finalPendingNonce !== EXPECTED_NONCE) {
    throw new Error(`Refusing final pending nonce ${finalPendingNonce}; expected 0`);
  }
  const finalFeeBasisWei = finalFeeData.maxFeePerGas ?? finalFeeData.gasPrice;
  if (finalFeeBasisWei === null) throw new Error("Aristotle RPC returned no final fee basis");
  const finalWorstCaseFeeWei = TOTAL_GAS_LIMIT * finalFeeBasisWei;
  if (finalWorstCaseFeeWei > APPROVED_MAX_FEE_WEI) {
    throw new Error("Final fee refresh exceeded the user-approved maximum fee envelope");
  }

  const feeOverrides = finalFeeData.maxFeePerGas !== null
    ? {
        maxFeePerGas: finalFeeData.maxFeePerGas,
        maxPriorityFeePerGas: minBigInt(
          finalFeeData.maxPriorityFeePerGas ?? finalFeeData.maxFeePerGas,
          finalFeeData.maxFeePerGas,
        ),
      }
    : { gasPrice: finalFeeData.gasPrice! };

  const factory = new ContractFactory(artifact.abi, artifact.bytecode, signer);
  const deployment = await factory.deploy({
    nonce: EXPECTED_NONCE,
    gasLimit: DEPLOY_GAS_LIMIT,
    ...feeOverrides,
  });
  const deploymentTransaction = deployment.deploymentTransaction();
  if (!deploymentTransaction) throw new Error("Registry deployment transaction is missing");
  const deploymentReceipt = await deploymentTransaction.wait();
  if (!deploymentReceipt || deploymentReceipt.status !== 1) {
    throw new Error("ProofRailRegistry deployment did not succeed");
  }
  const contractAddress = await deployment.getAddress();
  if (!sameHex(contractAddress, EXPECTED_CONTRACT)) {
    throw new Error(`Deployed registry address ${contractAddress} did not match approved address`);
  }

  const registry = new Contract(contractAddress, artifact.abi, signer);
  const simulatedRecordId = await registry.registerEvidence.staticCall(
    commitments.manifestDigest,
    commitments.sourceClaimDigest,
    commitments.publisherArtifactDigest,
    commitments.reproducedArtifactDigest,
    commitments.provenanceRoot,
  );
  if (!sameHex(simulatedRecordId, EXPECTED_RECORD_ID)) {
    throw new Error("Post-deployment registration simulation returned an unexpected record ID");
  }

  const registrationTransaction = await registry.registerEvidence(
    commitments.manifestDigest,
    commitments.sourceClaimDigest,
    commitments.publisherArtifactDigest,
    commitments.reproducedArtifactDigest,
    commitments.provenanceRoot,
    {
      nonce: EXPECTED_NONCE + 1,
      gasLimit: REGISTER_GAS_LIMIT,
      ...feeOverrides,
    },
  );
  const registrationReceipt = await registrationTransaction.wait();
  if (!registrationReceipt || registrationReceipt.status !== 1) {
    throw new Error("M5 evidence registration did not succeed");
  }

  const stored = await registry.getEvidence(EXPECTED_RECORD_ID);
  const readbackMatches =
    sameHex(stored.manifestDigest, commitments.manifestDigest) &&
    sameHex(stored.sourceClaimDigest, commitments.sourceClaimDigest) &&
    sameHex(stored.publisherArtifactDigest, commitments.publisherArtifactDigest) &&
    sameHex(stored.reproducedArtifactDigest, commitments.reproducedArtifactDigest) &&
    sameHex(stored.provenanceRoot, commitments.provenanceRoot) &&
    sameHex(stored.submitter, signer.address);
  if (!readbackMatches) {
    throw new Error("Aristotle registry read-back did not exactly match the approved M5 commitments");
  }

  const actualFeeWei = deploymentReceipt.fee + registrationReceipt.fee;
  if (actualFeeWei > APPROVED_MAX_FEE_WEI) {
    throw new Error("Actual transaction fees exceeded the user-approved maximum fee envelope");
  }

  const endingBalanceWei = await provider.getBalance(signer.address);
  process.stdout.write(JSON.stringify({
    ...common,
    status: "ARISTOTLE_MAINNET_ANCHOR_COMPLETE",
    mainnetWrites: true,
    finalFeeBasisWei: finalFeeBasisWei.toString(),
    finalWorstCaseFeeWei: finalWorstCaseFeeWei.toString(),
    finalWorstCaseFee0G: formatEther(finalWorstCaseFeeWei),
    deployment: {
      transactionHash: deploymentReceipt.hash,
      blockNumber: deploymentReceipt.blockNumber,
      gasUsed: deploymentReceipt.gasUsed.toString(),
      feeWei: deploymentReceipt.fee.toString(),
      fee0G: formatEther(deploymentReceipt.fee),
    },
    registration: {
      transactionHash: registrationReceipt.hash,
      blockNumber: registrationReceipt.blockNumber,
      gasUsed: registrationReceipt.gasUsed.toString(),
      feeWei: registrationReceipt.fee.toString(),
      fee0G: formatEther(registrationReceipt.fee),
      readbackMatches: true,
      submitter: stored.submitter,
      registeredAt: stored.registeredAt.toString(),
    },
    actualTotalFeeWei: actualFeeWei.toString(),
    actualTotalFee0G: formatEther(actualFeeWei),
    endingBalanceWei: endingBalanceWei.toString(),
    endingBalance0G: formatEther(endingBalanceWei),
    explorer: {
      contract: `https://chainscan.0g.ai/address/${contractAddress}`,
      deploymentTransaction: `https://chainscan.0g.ai/tx/${deploymentReceipt.hash}`,
      registrationTransaction: `https://chainscan.0g.ai/tx/${registrationReceipt.hash}`,
    },
  }, null, 2) + "\n");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(JSON.stringify({ name: "Error", message }) + "\n");
  process.exitCode = 1;
});
