export interface WorkerEnvironment {
  ZEROG_STORAGE_PRIVATE_KEY?: string;
  AEGISONE_WORKER_INTERNAL_TOKEN?: string;
  AEGISONE_REGISTRY_CONTRACT?: string;
}

export interface WorkerStatus {
  ok: boolean;
  service: "proofrail-worker";
  mode: "standby";
  signerConfigured: boolean;
  publicSigningEnabled: false;
  /** Whether the internal, token-authenticated evidence-publication route is enabled. False means
   * the route does not exist at all (fail closed) — not that it exists unauthenticated. */
  publishRouteEnabled: boolean;
  /** Whether the optional compact on-chain commitment is configured. Storage-only publication is
   * a valid, complete mode; this simply reports which of the two the worker will perform. */
  registryCommitmentEnabled: boolean;
}

/**
 * `/health` shape. Deliberately reports only booleans about configuration presence: never a token,
 * never a key, never an address prefix, never anything from which a secret could be reconstructed
 * (docs/17 Threat M8-006).
 */
export function createWorkerStatus(env: WorkerEnvironment = process.env): WorkerStatus {
  const signerConfigured = Boolean(env.ZEROG_STORAGE_PRIVATE_KEY?.trim());
  const publishRouteEnabled = Boolean(env.AEGISONE_WORKER_INTERNAL_TOKEN?.trim());
  return {
    ok: signerConfigured,
    service: "proofrail-worker",
    mode: "standby",
    signerConfigured,
    publicSigningEnabled: false,
    publishRouteEnabled,
    registryCommitmentEnabled: publishRouteEnabled && Boolean(env.AEGISONE_REGISTRY_CONTRACT?.trim()),
  };
}
