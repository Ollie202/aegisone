# Project State

**Last updated:** 2026-08-18  
**Phase:** M6 final merge gate — product runtime + persistent Supabase job index proven
**Product name:** ProofRail *(working name only)*

## Current product thesis

ProofRail independently rebuilds software from an explicit publisher source claim and compares the reproduced artifact bytes with the publisher artifact. Application state is never allowed to invent or override a cryptographic `MATCH` / `MISMATCH` result.

The product trust boundary is:

> **publisher artifact vs independent rebuild — verified from canonical evidence, not from mutable application state**

## Proven foundation

- M1–M5 are complete and merged.
- Real 0G Sandbox reproduction, proof-verified 0G Storage, and Aristotle mainnet anchoring are proven.
- The M5 Aristotle registry remains deployed at `0xeD2361a6B56dc0d4a7494F3a46BA47f352050BA4` with record `0xef2c77f9c39b77ce12328a404afcde9e935761a2d4fc9dfedff1f3b873f3ce4e`.
- M4's current TDX surface remains honestly classified as `PROVIDER_EVIDENCE_ONLY`; missing artifact-digest binding is a capability boundary, not an operational failure.

## M6 product topology — proven

```text
Supabase       = mutable app/job memory
Railway app    = product API/UI
Railway worker = controlled secret-bearing worker, standby by default
0G Sandbox     = independent build/execution
0G Storage     = durable canonical evidence
0G Aristotle   = immutable compact commitment anchor
```

Supabase is **not** a proof authority. The schema deliberately has no mutable verdict column. Cached verification JSON can display MATCH/MISMATCH only after the existing ProofRail core integrity checks accept it.

## What M6 has proven

- `packages/job-store` provides a database-independent job model with `queued`, `running`, `verified`, and `failed` pipeline states.
- Artifact families already distinguish `software` and `agent-skill` without changing core correspondence semantics.
- A dedicated Supabase project named `ProofRail` exists in `eu-west-1`; provider-reported project cost is `$0/month` for the current organization.
- `verification_jobs` is RLS-enabled and stores application metadata plus 0G evidence pointers, not a mutable verdict.
- Railway talks to Supabase through an authenticated `proofrail-jobs` Edge Function. Supabase keeps its service-role credential inside the Edge Function; Railway holds only a separate ProofRail app token plus a publishable key.
- Supabase security advisor is clean after the final schema. Performance advisor only reports unused-index informational notices expected for a new table.
- `proofrail-app` is live on Railway and backed by Supabase rather than the temporary memory store.
- A live external API smoke test returned `/health` 200, created job `085e2667-c2ca-4d98-919b-106eb2ff4334`, read it back through the app, and independent SQL confirmed the exact same persisted row.
- `packages/sandbox-0g/scripts/inspect-live.ts` now reports expected TEE capability limitations without exiting as a Railway crash.
- A permanent `proofrail-worker` Railway service is proven healthy on the service-neutral M6 code.
- Worker startup confirms the shared signer secret is configured while public signing remains disabled. The signer is stored as the project-level shared `ZEROG_STORAGE_PRIVATE_KEY`; it was not copied into GitHub or exposed.
- The repository root Railway config is service-neutral so new services cannot accidentally inherit the historical M2 Storage round-trip command.
- The five milestone-only Railway services are staged for deletion. Railway requires dashboard 2FA to finalize those destructive removals; `proofrail-app`, `proofrail-worker`, and the shared signer secret are explicitly excluded from deletion.
- Historical M1–M5 evidence remains in GitHub, 0G Storage, and Aristotle regardless of Railway service cleanup.

## Final Railway target

After the staged deletions are confirmed in the Railway dashboard, the visible product topology is intentionally just:

1. `proofrail-app` — API/UI + Supabase-backed job index.
2. `proofrail-worker` — controlled worker/secret boundary; standby and non-public by default.

## M7 — Agent Skills next

Issue #12 makes Agent Skills the first new auditable artifact family. ProofRail will keep two independent answers:

1. **Correspondence:** do distributed skill-package bytes match the deterministic package independently produced from the exact publisher-declared source commit? → `MATCH` / `MISMATCH`.
2. **Security audit:** what risky instructions, scripts, dependencies, exfiltration paths, destructive operations, hidden payloads, or persistence behaviors exist? → separate findings and severity.

A `MATCH` never means “safe,” and a security finding never rewrites the cryptographic correspondence result.

## Remaining gates

- Final CI must pass on the completed M6 branch head, then PR #13 can be marked ready and squash-merged and Issue #11 must close.
- Separately, the five already-staged Railway service deletions require interactive dashboard 2FA to become permanent.
