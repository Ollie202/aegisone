import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  Contract,
  ContractFactory,
  JsonRpcProvider,
  Wallet,
  formatEther,
} from "ethers";
import { canonicalJson } from "../../core/src/canonical.ts";
import { createVerification } from "../../core/src/verify.ts";
import { runLocalBuild } from "../../runner-local/src/run.ts";
import { makeHelloAegisOneFixture } from "../../../examples/hello-aegisone/fixture.ts";
import { AEGISONE_REGISTRY_ABI } from "../src/abi.ts";
import { computeRegistryRecordId } from "../src/client.ts";
import { createRegistryCommitments } from "../src/commitments.ts";

const GALILEO_RPC = "https://evmrpc-testnet.0g.ai";
const GALILEO_CHAIN_ID = 16602n;
const MAINNET_RPC = "https://evmrpc.0g.ai";
const MAINNET_CHAIN_ID = 16661n;

// Canonical M2 evidence recorded in hackathon/evidence.md.
const M2_PROVENANCE_ROOT = "0x19f0e4b46fb16401a1fae25378084589fa1a32bf41fa312a4f83f2672a164310";
const M2_MANIFEST_SHA256 = "f922f7f7bc7e342526b9ae9becf3bbad1c9d5efba5417c798cbdbf98bb0f1594";

interface HardhatArtifact {
  abi: unknown[];
  bytecode: string;
}

function normalizePrivateKey(): string {
  let value = (process.env.ZEROG_REGISTRY_PRIVATE_KEY ?? process.env.ZEROG_STORAGE_PRIVATE_KEY)?.trim();
  if (!value) {
    throw new Error(
      "Owner action required: configure a funded Galileo test wallet as ZEROG_REGISTRY_PRIVATE_KEY or ZEROG_STORAGE_PRIVATE_KEY",
    );
  }
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    value = value.slice(1, -1).trim();
  }
  for (const prefix of ["ZEROG_REGISTRY_PRIVATE_KEY=", "ZEROG_STORAGE_PRIVATE_KEY="]) {
    if (value.startsWith(prefix)) value = value.slice(prefix.length).trim();
  }
  const normalized = value.startsWith("0x") ? value : `0x${value}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error("Registry signer must be a 32-byte hexadecimal private key");
  }
  return normalized;
}

async function assertChain(provider: JsonRpcProvider, expected: bigint, label: string): Promise<void> {
  const network = await provider.getNetwork();
  if (network.chainId !== expected) {
    throw new Error(`${label} RPC returned chain ID ${network.chainId.toString()}, expected ${expected.toString()}`);
  }
}

function sameHex(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

async function main(): Promise<void> {
  const privateKey = normalizePrivateKey();
  const artifactPath = resolve(
    import.meta.dirname,
    "../../../contracts/artifacts/src/AegisOneRegistry.sol/AegisOneRegistry.json",
  );
  const artifact = JSON.parse(await readFile(artifactPath, "utf8")) as HardhatArtifact;
  if (!artifact.bytecode || artifact.bytecode === "0x") throw new Error("Compiled registry bytecode is missing");

  const fixture = await makeHelloAegisOneFixture();
  try {
    const build = await runLocalBuild({
      source: fixture.claim.source,
      recipe: fixture.recipe,
      repositoryPath: fixture.repositoryPath,
    });
    const verification = createVerification({
      claim: fixture.claim,
      recipe: fixture.recipe,
      publisherBytes: fixture.publisherBytes,
      reproducedBytes: build.artifactBytes,
      environment: build.environment,
    });
    if (verification.correspondence.status !== "MATCH") {
      throw new Error("Refusing to register M3 evidence for a non-matching fixture reproduction");
    }
    if (verification.manifestSha256 !== M2_MANIFEST_SHA256) {
      throw new Error(
        `M3 fixture manifest ${verification.manifestSha256} does not match canonical M2 manifest ${M2_MANIFEST_SHA256}`,
      );
    }

    const commitments = createRegistryCommitments(verification, M2_PROVENANCE_ROOT);
    const recordId = computeRegistryRecordId(commitments);

    const galileo = new JsonRpcProvider(GALILEO_RPC);
    await assertChain(galileo, GALILEO_CHAIN_ID, "Galileo");
    const signer = new Wallet(privateKey, galileo);

    const factory = new ContractFactory(artifact.abi, artifact.bytecode, signer);
    const deployment = await factory.deploy();
    const deploymentTransaction = deployment.deploymentTransaction();
    if (!deploymentTransaction) throw new Error("Registry deployment transaction is missing");
    const deploymentReceipt = await deploymentTransaction.wait();
    if (!deploymentReceipt) throw new Error("Registry deployment was not mined");
    const contractAddress = await deployment.getAddress();

    const registry = new Contract(contractAddress, AEGISONE_REGISTRY_ABI, signer);
    const registrationTransaction = await registry.registerEvidence(
      commitments.manifestDigest,
      commitments.sourceClaimDigest,
      commitments.publisherArtifactDigest,
      commitments.reproducedArtifactDigest,
      commitments.provenanceRoot,
    );
    const registrationReceipt = await registrationTransaction.wait();
    if (!registrationReceipt) throw new Error("Registry registration was not mined");

    const stored = await registry.getEvidence(recordId);
    const readbackMatches =
      sameHex(stored.manifestDigest, commitments.manifestDigest) &&
      sameHex(stored.sourceClaimDigest, commitments.sourceClaimDigest) &&
      sameHex(stored.publisherArtifactDigest, commitments.publisherArtifactDigest) &&
      sameHex(stored.reproducedArtifactDigest, commitments.reproducedArtifactDigest) &&
      sameHex(stored.provenanceRoot, commitments.provenanceRoot) &&
      sameHex(stored.submitter, signer.address);
    if (!readbackMatches) throw new Error("Registry read-back did not exactly match the submitted commitments");

    const mainnet = new JsonRpcProvider(MAINNET_RPC);
    await assertChain(mainnet, MAINNET_CHAIN_ID, "0G mainnet");
    const feeData = await mainnet.getFeeData();
    const mainnetGasPrice = feeData.gasPrice ?? feeData.maxFeePerGas;
    if (mainnetGasPrice === null) throw new Error("0G mainnet RPC did not return a usable gas price");

    const deploymentCostWei = deploymentReceipt.gasUsed * mainnetGasPrice;
    const registrationCostWei = registrationReceipt.gasUsed * mainnetGasPrice;
    const estimatedTotalWei = deploymentCostWei + registrationCostWei;

    process.stdout.write(
      canonicalJson({
        schemaVersion: "1",
        network: "0G Galileo Testnet",
        chainId: Number(GALILEO_CHAIN_ID),
        rpcUrl: GALILEO_RPC,
        signerAddress: signer.address,
        contractAddress,
        recordId,
        sourceCommitSha: fixture.commitSha,
        manifestSha256: verification.manifestSha256,
        commitments,
        deploymentTransactionHash: deploymentReceipt.hash,
        registrationTransactionHash: registrationReceipt.hash,
        readbackMatches: true,
        gas: {
          deploymentGasUsed: deploymentReceipt.gasUsed.toString(),
          registrationGasUsed: registrationReceipt.gasUsed.toString(),
          mainnetGasPriceWei: mainnetGasPrice.toString(),
          estimatedMainnetDeploymentWei: deploymentCostWei.toString(),
          estimatedMainnetRegistrationWei: registrationCostWei.toString(),
          estimatedMainnetTotalWei: estimatedTotalWei.toString(),
          estimatedMainnetTotal0G: formatEther(estimatedTotalWei),
        },
        toolchain: {
          solidity: "0.8.24",
          evmVersion: "cancun",
          hardhat: "2.23.0",
        },
      }) + "\n",
    );
  } finally {
    await fixture.cleanup();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(JSON.stringify({ name: "Error", message }) + "\n");
  process.exitCode = 1;
});
