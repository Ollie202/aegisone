export * from "./model.ts";
export * from "./canonical-key.ts";
export * from "./upsert-plan.ts";
export * from "./convert.ts";
export * from "./source-claim-transition.ts";
export * from "./capability-verification-validation.ts";
export * from "./store.ts";
export * from "./memory.ts";
export * from "./supabase.ts";

import type { CatalogStore } from "./store.ts";
import { InMemoryCatalogStore } from "./memory.ts";
import { SupabaseCatalogStore } from "./supabase.ts";

export interface CatalogStoreEnvironment {
  PROOFRAIL_CATALOG_STORE?: string;
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  PROOFRAIL_SUPABASE_APP_TOKEN?: string;
}

export function createCatalogStoreFromEnv(env: CatalogStoreEnvironment = process.env): CatalogStore {
  const mode = env.PROOFRAIL_CATALOG_STORE?.trim().toLowerCase();
  if (mode === "memory") return new InMemoryCatalogStore();

  const url = env.SUPABASE_URL?.trim();
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY?.trim();
  const appToken = env.PROOFRAIL_SUPABASE_APP_TOKEN?.trim();
  if (url && publishableKey && appToken) {
    return new SupabaseCatalogStore({ url, publishableKey, appToken });
  }

  throw new Error(
    "ProofRail product mode requires SUPABASE_URL + SUPABASE_PUBLISHABLE_KEY + PROOFRAIL_SUPABASE_APP_TOKEN. " +
    "Use PROOFRAIL_CATALOG_STORE=memory only for local smoke tests.",
  );
}
