# `@proofrail/discovery-providers`

Real, read-only federated discovery adapters for ProofRail M8.3.

This package owns the HTTP boundary to fixed, allowlisted third-party discovery origins and normalizes their results into the provider-independent `@proofrail/capability-model` `CapabilityResource` shape. It performs no upstream write, no authentication, no install/execute behavior, and has no wallet, signer, Supabase, LLM, or 0G capability.

## Providers

| Provider | Contract reference pin | Endpoint |
| --- | --- | --- |
| GitHub Agent Finder | `ards-project/ard-connectors@53cc4f3a4596cf51482fabeb554d124ca248ed07` | `POST https://agentfinder.github.com/api/v1/search` |
| Hugging Face Discover | `huggingface/hf-discover@49c927439fcaa8f210cfd42186c0641acef579fa` | `POST https://huggingface-hf-discover.hf.space/search` |

Both are public and unauthenticated for the search flow used here. ProofRail never requires or forwards a user Hugging Face token.

Both upstreams speak the same ARD search request/response wire shape (`{ query: { text, filter? }, pageSize }` -> `{ results: [...] }`), so both are built from one shared factory, `createArdWireDiscoveryProvider` (`src/ard-wire-provider.ts`).

## Why this package does not reuse `@proofrail/discovery-ard`'s entry validator

`@proofrail/discovery-ard`'s `assertValidArdEntry` enforces ProofRail's own outbound catalog identifier convention (`urn:air:...`). Live-recorded GitHub Agent Finder responses use `urn:ai:...` identifiers instead (see `test/fixtures.ts`, captured 2026-08-26), so reusing that validator for *inbound* third-party normalization would silently drop every GitHub Agent Finder result. `src/normalize.ts` is a separate, deliberately lenient inbound normalizer: it requires only the minimum ARD-search-result-shaped fields ProofRail actually needs (`identifier`, `displayName`, a supported `type`, and `url` xor `data`), does not assume any particular identifier scheme, and drops a malformed entry rather than failing the whole provider call.

## Trust boundary (read this before touching `normalize.ts`)

`normalizeProviderEntry` always emits an empty/unavailable `CapabilityResource.trust` (`sourceAssurance: NONE`, `sourceInspection: NOT_RUN`, `correspondence: NOT_EVALUATED`, `security: NOT_RUN`, `canonicalEvidence: NONE`), regardless of what the upstream entry's `trustManifest`, `metadata`, `score`, or `source` fields claim — including if those fields are forged to look like ProofRail's own `org.proofrail.*` evidence namespace. This is exercised directly in `test/normalize.test.ts`'s trust-escalation regression test. `discovery.relevanceScore` carries the upstream relevance score (0–1, from the upstream's own 0–100 scale) as discovery metadata only; it is never read as, or converted into, trust/security evidence, and scores from different providers are never treated as globally comparable.

## Safety envelope (`src/http.ts`, `src/constants.ts`)

- fixed allowlisted origins only (`DISCOVERY_PROVIDER_ALLOWED_ORIGINS`); any other origin is rejected before a request is sent;
- redirects are never followed (`redirect: "manual"`; a 3xx or opaque redirect response is a `redirect_blocked` failure);
- ~3 second per-provider timeout (`DEFAULT_PROVIDER_TIMEOUT_MS`), ~5 second total federated search deadline (`DEFAULT_TOTAL_SEARCH_DEADLINE_MS`), enforced with `AbortSignal.any`;
- response body is streamed and capped at 1 MiB (`DEFAULT_MAX_RESPONSE_BYTES`), checked incrementally (not just via a possibly-absent `Content-Length` header);
- at most 25 accepted results per provider per request (`DEFAULT_MAX_RESULTS_PER_PROVIDER`), enforced both in the outbound `pageSize` and by truncating the inbound result list;
- at most one retry, only for a transient failure (network error, timeout, or 5xx), and only if the shared deadline has not already elapsed;
- one provider's failure (timeout, network error, malformed/oversized response) never fails another provider's result — see `federatedDiscoverySearch` in `src/aggregate.ts`, which always returns partial results plus a per-provider status.

## Deduplication

`dedupeCapabilityResources` (`src/dedupe.ts`) is deterministic: it keys each resource by its normalized `discovery.resourceUrl` (falling back to `kind` + normalized name when no URL is present), and keeps the *first* resource seen for a given key. Callers control priority entirely through input order (the configured provider order, then each provider's own returned order) — there is no cross-provider score comparison, because relevance scores from different providers are not globally calibrated.

## What this package intentionally does not do

- no Supabase/catalog persistence (M8.4, out of scope here);
- no GitHub publisher/source authentication (M8.5, out of scope here);
- no Agent Skill verification orchestration (M8.6, out of scope here);
- no MCP Registry ingestion (M8.10, out of scope here);
- no install/execute of a discovered resource;
- no paid API key, embeddings service, or vector database.

## Tests

- `test/*.test.ts` — deterministic unit/fixture tests (default `pnpm check` / `pnpm test`), including recorded live-response fixtures in `test/fixtures.ts`.
- `test/live/*.live.test.ts` — real network smoke tests against both pinned live endpoints. **Not** part of `pnpm check` / `pnpm test` (the glob only matches `test/*.test.ts`). Run explicitly:

  ```bash
  pnpm --filter @proofrail/discovery-providers test:live
  # or, from the repo root:
  pnpm m8.3:live
  ```
