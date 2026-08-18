export interface WorkerEnvironment {
  ZEROG_STORAGE_PRIVATE_KEY?: string;
}

export interface WorkerStatus {
  ok: boolean;
  service: "proofrail-worker";
  mode: "standby";
  signerConfigured: boolean;
  publicSigningEnabled: false;
}

export function createWorkerStatus(env: WorkerEnvironment = process.env): WorkerStatus {
  const signerConfigured = Boolean(env.ZEROG_STORAGE_PRIVATE_KEY?.trim());
  return {
    ok: signerConfigured,
    service: "proofrail-worker",
    mode: "standby",
    signerConfigured,
    publicSigningEnabled: false,
  };
}
