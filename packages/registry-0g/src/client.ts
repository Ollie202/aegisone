import {
  AbiCoder,
  Contract,
  getAddress,
  keccak256,
  type ContractRunner,
  type Signer,
} from "ethers";
import { PROOFRAIL_REGISTRY_ABI } from "./abi.ts";
import {
  assertRegistryCommitments,
  requireBytes32,
  type Bytes32Hex,
  type RegistryCommitments,
} from "./commitments.ts";

export interface RegistryRecord extends RegistryCommitments {
  recordId: Bytes32Hex;
  submitter: string;
  registeredAt: number;
}

export interface RegistryWriteReceipt {
  recordId: Bytes32Hex;
  transactionHash: string;
  blockNumber: number;
  gasUsed: string;
}

export function computeRegistryRecordId(value: RegistryCommitments): Bytes32Hex {
  assertRegistryCommitments(value);
  const encoded = AbiCoder.defaultAbiCoder().encode(
    ["bytes32", "bytes32", "bytes32", "bytes32", "bytes32"],
    [
      value.manifestDigest,
      value.sourceClaimDigest,
      value.publisherArtifactDigest,
      value.reproducedArtifactDigest,
      value.provenanceRoot,
    ],
  );
  return keccak256(encoded) as Bytes32Hex;
}

export function registryContract(address: string, runner: ContractRunner): Contract {
  return new Contract(getAddress(address), PROOFRAIL_REGISTRY_ABI, runner);
}

export async function registerEvidence(
  signer: Signer,
  address: string,
  value: RegistryCommitments,
): Promise<RegistryWriteReceipt> {
  assertRegistryCommitments(value);
  const recordId = computeRegistryRecordId(value);
  const contract = registryContract(address, signer);
  const transaction = await contract.registerEvidence(
    value.manifestDigest,
    value.sourceClaimDigest,
    value.publisherArtifactDigest,
    value.reproducedArtifactDigest,
    value.provenanceRoot,
  );
  const receipt = await transaction.wait();
  if (!receipt) throw new Error("Registry transaction was not mined");
  return {
    recordId,
    transactionHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed.toString(),
  };
}

export async function readEvidence(
  runner: ContractRunner,
  address: string,
  recordId: string,
): Promise<RegistryRecord | null> {
  const normalizedRecordId = requireBytes32(recordId, "recordId");
  const contract = registryContract(address, runner);
  if (!(await contract.exists(normalizedRecordId))) return null;
  const result = await contract.getEvidence(normalizedRecordId);
  return {
    recordId: normalizedRecordId,
    manifestDigest: requireBytes32(result.manifestDigest, "manifestDigest"),
    sourceClaimDigest: requireBytes32(result.sourceClaimDigest, "sourceClaimDigest"),
    publisherArtifactDigest: requireBytes32(result.publisherArtifactDigest, "publisherArtifactDigest"),
    reproducedArtifactDigest: requireBytes32(result.reproducedArtifactDigest, "reproducedArtifactDigest"),
    provenanceRoot: requireBytes32(result.provenanceRoot, "provenanceRoot"),
    submitter: getAddress(result.submitter),
    registeredAt: Number(result.registeredAt),
  };
}
