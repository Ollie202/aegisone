import type { ZeroGComputeConfig } from "./types.ts";

export interface ComputeEnv {
  ZEROG_COMPUTE_PRIVATE_KEY?: string;
  ZEROG_COMPUTE_MODEL_PROVIDER?: string;
  ZEROG_COMPUTE_RPC_URL?: string;
}

const DEFAULT_RPC_URL = "https://evmrpc-testnet.0g.ai";
// 0G Compute Network's documented official llama-3.3-70b-instruct inference provider address on
// Galileo testnet, used only as the default when ZEROG_COMPUTE_MODEL_PROVIDER is unset. Recorded
// as an implementation-target pin, not verified live (see PR description / docs/15).
const DEFAULT_MODEL_PROVIDER = "0xf07240Efa67755B5311bc75784a061eDB47165Dd";

/**
 * Returns `null` (never a fabricated/guessed config) when `ZEROG_COMPUTE_PRIVATE_KEY` is not
 * set. Callers (apps/web) must treat a `null` config as "advisory tier unavailable" and respond
 * with an explicit `advisory_unavailable` state rather than silently skipping or inventing a
 * result — see docs/17-m8-security-boundaries.md.
 */
export function createZeroGComputeConfigFromEnv(env: ComputeEnv = process.env): ZeroGComputeConfig | null {
  const privateKey = env.ZEROG_COMPUTE_PRIVATE_KEY?.trim();
  if (!privateKey) return null;
  return {
    privateKey,
    modelProvider: env.ZEROG_COMPUTE_MODEL_PROVIDER?.trim() || DEFAULT_MODEL_PROVIDER,
    rpcUrl: env.ZEROG_COMPUTE_RPC_URL?.trim() || DEFAULT_RPC_URL,
  };
}
