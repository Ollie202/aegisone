import { readFile } from "node:fs/promises";
import {
  AbiCoder,
  Interface,
  JsonRpcProvider,
  computeAddress,
  formatEther,
  getCreateAddress,
  keccak256,
} from "ethers";

const ARISTOTLE_RPC = "https://evmrpc.0g.ai";
const ARISTOTLE_CHAIN_ID = 16661n;
const GALILEO_DEPLOY_GAS = 299829n;
const GALILEO_REGISTER_GAS = 161123n;
const SAFETY_NUMERATOR = 120n;
const SAFETY_DENOMINATOR = 100n;

const commitments = {
  manifestDigest: "0xb0ac39ac60df76f427311e3d1fce665b820b81a9c4b39481ce16843804419a54",
  sourceClaimDigest: "0xfcb0a23bcdf13648437b160e5a6dbc04b24f2399460c030753e194606e4e611a",
  publisherArtifactDigest: "0x9978d500ee45216cb6c93b886857100ce95b63f6135dd339ace7ff533d9aa154",
  reproducedArtifactDigest: "0x9978d500ee45216cb6c93b886857100ce95b63f6135dd339ace7ff533d9aa154",
  provenanceRoot: "0xc727fe83637fa9e323c84f2f7507599c9778cc9081a5b762cf5ba4fd54bdf181",
} as const;

function normalizePrivateKey(value: string): string {
  const trimmed = value.trim();
  const normalized = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new TypeError("Pre-mainnet private key must be a 32-byte hexadecimal value");
  }
  return normalized;
}

function safetyGas(value: bigint): bigint {
  return (value * SAFETY_NUMERATOR + SAFETY_DENOMINATOR - 1n) / SAFETY_DENOMINATOR;
}

const privateKeyRaw = process.env.ZEROG_SANDBOX_PRIVATE_KEY?.trim();
if (!privateKeyRaw) throw new Error("ZEROG_SANDBOX_PRIVATE_KEY is required for public-address derivation only");

// Deliberately derive only the public address. This script creates no signer and has no send/sign path.
const address = computeAddress(normalizePrivateKey(privateKeyRaw));
const provider = new JsonRpcProvider(ARISTOTLE_RPC);
const network = await provider.getNetwork();
if (network.chainId !== ARISTOTLE_CHAIN_ID) {
  throw new Error(`Refusing unexpected Aristotle chain ID ${network.chainId}`);
}

const [blockNumber, feeData, balanceWei, nonce] = await Promise.all([
  provider.getBlockNumber(),
  provider.getFeeData(),
  provider.getBalance(address),
  provider.getTransactionCount(address, "latest"),
]);

const artifact = JSON.parse(
  await readFile("contracts/artifacts/src/ProofRailRegistry.sol/ProofRailRegistry.json", "utf8"),
) as { abi: unknown[]; bytecode: string };
if (!artifact.bytecode.startsWith("0x") || artifact.bytecode.length <= 2) {
  throw new Error("Compiled ProofRailRegistry artifact has no deployment bytecode");
}

let mainnetDeployEstimate: bigint | null = null;
let deployEstimateError: string | null = null;
try {
  mainnetDeployEstimate = await provider.estimateGas({ from: address, data: artifact.bytecode });
} catch (error) {
  deployEstimateError = error instanceof Error ? error.message : String(error);
}

const predictedContractAddress = getCreateAddress({ from: address, nonce });
const predictedCode = await provider.getCode(predictedContractAddress);
const registryInterface = new Interface(artifact.abi);
const registrationCalldata = registryInterface.encodeFunctionData("registerEvidence", [
  commitments.manifestDigest,
  commitments.sourceClaimDigest,
  commitments.publisherArtifactDigest,
  commitments.reproducedArtifactDigest,
  commitments.provenanceRoot,
]);
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

const deployGasBasis = mainnetDeployEstimate ?? GALILEO_DEPLOY_GAS;
const deployGasLimit = safetyGas(deployGasBasis);
const registerGasLimit = safetyGas(GALILEO_REGISTER_GAS);
const gasPriceWei = feeData.gasPrice;
const maxFeePerGasWei = feeData.maxFeePerGas;
const feeBasisWei = maxFeePerGasWei ?? gasPriceWei;
const totalGasLimit = deployGasLimit + registerGasLimit;
const estimatedMaxFeeWei = feeBasisWei === null ? null : totalGasLimit * feeBasisWei;
const sufficientAtCurrentFeeBasis = estimatedMaxFeeWei === null ? null : balanceWei >= estimatedMaxFeeWei;

console.log(JSON.stringify({
  schemaVersion: "1",
  check: "PROOFRAIL_ARISTOTLE_READ_ONLY_GATE",
  readOnly: true,
  mainnetWrites: false,
  rpc: ARISTOTLE_RPC,
  chainId: Number(network.chainId),
  latestBlock: blockNumber,
  wallet: {
    address,
    nonce,
    balanceWei: balanceWei.toString(),
    balance0G: formatEther(balanceWei),
  },
  feeSnapshot: {
    gasPriceWei: gasPriceWei?.toString() ?? null,
    maxFeePerGasWei: maxFeePerGasWei?.toString() ?? null,
    maxPriorityFeePerGasWei: feeData.maxPriorityFeePerGas?.toString() ?? null,
  },
  contract: {
    compiler: "0.8.24",
    evmVersion: "cancun",
    deploymentBytecodeSha256NotUsed: true,
    deploymentBytecodeKeccak256: keccak256(artifact.bytecode),
    currentNoncePredictedAddress: predictedContractAddress,
    predictedAddressAlreadyHasCode: predictedCode !== "0x",
    mainnetDeploymentGasEstimate: mainnetDeployEstimate?.toString() ?? null,
    mainnetDeploymentEstimateError: deployEstimateError,
    galileoMeasuredDeploymentGas: GALILEO_DEPLOY_GAS.toString(),
    proposedDeploymentGasLimit120pct: deployGasLimit.toString(),
  },
  registration: {
    galileoMeasuredRegistrationGas: GALILEO_REGISTER_GAS.toString(),
    proposedRegistrationGasLimit120pct: registerGasLimit.toString(),
    recordId,
    calldataKeccak256: keccak256(registrationCalldata),
    calldataBytes: (registrationCalldata.length - 2) / 2,
    commitments,
  },
  proposedSequence: [
    { nonce, action: "DEPLOY_PROOFRAIL_REGISTRY", to: null, valueWei: "0", gasLimit: deployGasLimit.toString() },
    { nonce: nonce + 1, action: "REGISTER_M5_EVIDENCE", to: predictedContractAddress, valueWei: "0", gasLimit: registerGasLimit.toString() },
  ],
  costGate: {
    totalProposedGasLimit: totalGasLimit.toString(),
    feeBasisWei: feeBasisWei?.toString() ?? null,
    estimatedMaxFeeWei: estimatedMaxFeeWei?.toString() ?? null,
    estimatedMaxFee0G: estimatedMaxFeeWei === null ? null : formatEther(estimatedMaxFeeWei),
    walletSufficientAtCurrentFeeBasis: sufficientAtCurrentFeeBasis,
  },
}, null, 2));
