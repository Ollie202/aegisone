import { createArdWireDiscoveryProvider, type ArdWireProviderConfig } from "./ard-wire-provider.ts";
import { HUGGING_FACE_DISCOVER_ENDPOINT, HUGGING_FACE_DISCOVER_PROVIDER_ID } from "./constants.ts";
import type { DiscoveryProvider } from "./types.ts";

export interface HuggingFaceDiscoverProviderOptions extends Pick<ArdWireProviderConfig, "timeoutMs" | "maxResponseBytes" | "maxResults" | "fetchImpl" | "allowedOrigins"> {}

/**
 * Hugging Face Discover discovery provider.
 *
 * Contract reference: `huggingface/hf-discover@49c927439fcaa8f210cfd42186c0641acef579fa`.
 * Endpoint: `POST https://huggingface-hf-discover.hf.space/search`. Public search only; AegisOne
 * never requires or forwards a user Hugging Face token for this call.
 *
 * The hosted response may include a top-level `referrals` array (e.g. pointing at the HF Spaces
 * registry). AegisOne only consumes `results`; referrals are discovery pointers, not resources,
 * and M8.3 does not follow them.
 */
export function createHuggingFaceDiscoverProvider(options: HuggingFaceDiscoverProviderOptions = {}): DiscoveryProvider {
  return createArdWireDiscoveryProvider({
    id: HUGGING_FACE_DISCOVER_PROVIDER_ID,
    endpoint: HUGGING_FACE_DISCOVER_ENDPOINT,
    ...options,
  });
}
