# `@aegisone/catalog-store`

Mutable capability-catalog persistence for the existing AegisOne Supabase project (M8.4).

This package owns `agentic_resources`, `resource_discoveries`, `resource_versions`, and
`ingestion_sources` — the deterministic-dedup/discovery/version bookkeeping layer that
sits under `@aegisone/discovery-ard` (M8.2) and `@aegisone/discovery-providers` (M8.3).
It does not add a new database project; it extends the same one `packages/job-store`
already uses (`supabase/migrations`, `supabase/functions`).

## Trust boundary

Supabase remains mutable application/catalog memory, not a proof authority (see
`docs/16-m8-database-plan.md`, `AGENTS.md`). Concretely:

- `resource_discoveries.discovery_status` (`INDEXED` / `STALE` / `UNAVAILABLE`) and
  `raw_relevance_score` are discovery-only fields; nothing in this package feeds them
  into `@aegisone/capability-model`'s trust-policy evaluator.
- `resource_versions` records exact source/distribution *claims* only. A row with only
  a `source_commit_sha` and no independent reproduction never implies `MATCH`.
- `catalogRecordToCapabilityResource` (the one function that turns catalog rows back
  into a `CapabilityResource`) always emits empty/unverified `trust` — it has no field
  to read a MATCH/MISMATCH, source-assurance, security, or canonical-evidence value
  from, because those tables (`source_claims`, `capability_verifications`) do not exist
  yet (deferred to M8.5/M8.6) and this package does not read them.
- provider outage handling (`markProviderDiscoveriesStale`) only ever mutates
  `discovery_status`; it never deletes `agentic_resources`/`resource_versions` rows or
  touches trust evidence.

## Persistence model

Mirrors `packages/job-store`'s Supabase pattern: `proofrail-app`/Railway never holds the
Supabase service-role secret. `SupabaseCatalogStore` calls a token-gated Edge Function
(`supabase/functions/aegisone-catalog`) using a normal publishable key plus the
independent `PROOFRAIL_SUPABASE_APP_TOKEN`; the Edge Function holds the service-role
credential and checks the app token's SHA-256 digest against
`public.proofrail_app_auth`, the same singleton table `packages/job-store` uses. All
four new public tables have RLS enabled with no anon/authenticated policies — only the
Edge Function's service role can read or write them.

`InMemoryCatalogStore` implements the same `CatalogStore` interface for tests/local
smoke runs (`PROOFRAIL_CATALOG_STORE=memory`).

## Dedup key

`computeCanonicalKeyFromResource` follows the preference order in
`docs/16-m8-database-plan.md`: a valid `urn:air:...` identifier, then
`<shortProviderSlug>::<providerResourceId>`, then a normalized resource URL. It is
purely a dedup key — never used as, or derived from, proof.
