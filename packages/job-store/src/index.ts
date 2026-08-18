export * from "./model.ts";
export * from "./memory.ts";
export * from "./supabase.ts";

import type { JobStore } from "./model.ts";
import { InMemoryJobStore } from "./memory.ts";
import { SupabaseJobStore } from "./supabase.ts";

export interface JobStoreEnvironment {
  PROOFRAIL_JOB_STORE?: string;
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  PROOFRAIL_SUPABASE_APP_TOKEN?: string;
}

export function createJobStoreFromEnv(env: JobStoreEnvironment = process.env): JobStore {
  const mode = env.PROOFRAIL_JOB_STORE?.trim().toLowerCase();
  if (mode === "memory") return new InMemoryJobStore();

  const url = env.SUPABASE_URL?.trim();
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY?.trim();
  const appToken = env.PROOFRAIL_SUPABASE_APP_TOKEN?.trim();
  if (url && publishableKey && appToken) {
    return new SupabaseJobStore({ url, publishableKey, appToken });
  }

  throw new Error(
    "ProofRail product mode requires SUPABASE_URL + SUPABASE_PUBLISHABLE_KEY + PROOFRAIL_SUPABASE_APP_TOKEN. " +
    "Use PROOFRAIL_JOB_STORE=memory only for local smoke tests.",
  );
}
