import { createHash } from "node:crypto";
import { ethers } from "ethers";
import { ZeroGSdkTransport } from "../../../packages/storage-0g/src/sdk.ts";
import { GALILEO } from "../../../packages/storage-0g/src/types.ts";
import { registerEvidence } from "../../../packages/registry-0g/src/client.ts";
import { requireBytes32 } from "../../../packages/registry-0g/src/commitments.ts";
import type { RegistryWriter } from "../../../packages/evidence-publish/src/publish.ts";
import type { PublishRouteConfig } from "./publish-route.ts";

/**
 * Assembles the real, secret-bearing 0G transports.
 *
 * This is the ONE module in the repository that reads `ZEROG_STORAGE_PRIVATE_KEY`, and it exists
 * only inside `apps/worker`. Nothing under `apps/web` imports it, directly or transitively
 * (`apps/web/test/m9-frontend-security-audit.test.ts` asserts no browser-reachable file even
 * references a 0G package, and `apps/worker/test/signer-boundary.test.ts` asserts the app source
 * tree never imports this module). Keeping construction here — rather than inside
 * `packages/evidence-publish` — is what allows the entire publication path to be unit-tested with
 * injected fakes while the private key stays confined to one deployable service.
 */

export interface PublishEnvironment {
  ZEROG_STORAGE_PRIVATE_KEY?: string;
  AEGISONE_WORKER_INTERNAL_TOKEN?: string;
  AEGISONE_REGISTRY_CONTRACT?: string;
  ZEROG_RPC_URL?: string;
  ZEROG_INDEXER_URL?: string;
}

/**
 * The compact on-chain commitment.
 *
 * Note what is fixed and what is caller-supplied: the contract address and the signer come from
 * worker configuration, never from the request. The request contributes only evidence digests, and
 * the ABI call is a fixed five-argument `registerEvidence`. There is no path by which a request
 * can choose a destination, a value, or arbitrary calldata (docs/17 Threat M8-006).
 *
 * All five commitments are real values `derivePublicationCommitments` produced from the
 * publication's own evidence; this writer only re-validates their shape and submits them. When the
 * publication lacks any of them, `publishEvidenceBundle` never calls this writer at all.
 */
function createRegistryWriter(env: PublishEnvironment, signer: ethers.Wallet): RegistryWriter | null {
  const contractAddress = env.AEGISONE_REGISTRY_CONTRACT?.trim();
  if (!contractAddress) return null;
  const address = ethers.getAddress(contractAddress);

  return {
    async register(commitments) {
      const receipt = await registerEvidence(signer, address, {
        manifestDigest: requireBytes32(commitments.manifestDigest, "manifestDigest"),
        sourceClaimDigest: requireBytes32(commitments.sourceClaimDigest, "sourceClaimDigest"),
        publisherArtifactDigest: requireBytes32(commitments.publisherArtifactDigest, "publisherArtifactDigest"),
        reproducedArtifactDigest: requireBytes32(commitments.reproducedArtifactDigest, "reproducedArtifactDigest"),
        provenanceRoot: requireBytes32(commitments.provenanceRoot, "provenanceRoot"),
      });
      return {
        recordId: receipt.recordId,
        transactionHash: receipt.transactionHash,
        contractAddress: address,
      };
    },
  };
}

export function buildPublishRouteConfig(env: PublishEnvironment): PublishRouteConfig {
  const token = env.AEGISONE_WORKER_INTERNAL_TOKEN?.trim();
  if (!token) throw new Error("AEGISONE_WORKER_INTERNAL_TOKEN is required to enable the publication route");
  const privateKey = env.ZEROG_STORAGE_PRIVATE_KEY?.trim();
  if (!privateKey) throw new Error("ZEROG_STORAGE_PRIVATE_KEY is required to enable the publication route");

  const transport = new ZeroGSdkTransport({
    privateKey,
    rpcUrl: env.ZEROG_RPC_URL?.trim() || undefined,
    indexerUrl: env.ZEROG_INDEXER_URL?.trim() || undefined,
  });

  return {
    // Only the digest is retained; the raw token is not stored on the config object.
    expectedTokenSha256: createHash("sha256").update(token, "utf8").digest("hex"),
    storage: transport,
    network: { network: GALILEO.network, chainId: GALILEO.chainId },
    registry: createRegistryWriter(env, transport.signer),
  };
}
