export * from "./model.ts";
export * from "./memory.ts";
export * from "./supabase.ts";

import type { JobStore } from "./model.ts";
import { InMemoryJobStore } from "./memory.ts";
import { SupabaseJobStore } from "./supabase.ts";

export interface JobStoreEnvironment {
  PROOFRAIL_JOB_STORE?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

export function createJobStoreFromEnv(env: JobStoreEnvironment = process.env): JobStore {
  const mode = env.PROOFRAIL_JOB_STORE?.trim().toLowerCase();
  if (mode === "memory") return new InMemoryJobStore();

  const url = env.SUPABASE_URL?.trim();
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (url && key) return new SupabaseJobStore({ url, serviceRoleKey: key });

  throw new Error(
    "ProofRail product mode requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY. " +
    "Use PROOFRAIL_JOB_STORE=memory only for local smoke tests.",
  );
}
