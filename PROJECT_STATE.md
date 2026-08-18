# Project State

**Last updated:** 2026-08-18  
**Phase:** M6 in progress — product runtime + Supabase app index
**Product name:** ProofRail *(working name only)*

## Current product thesis

ProofRail does **not** determine whether code is good or bad and does **not** magically identify an official source repository.

The publisher supplies a source/release claim. ProofRail independently rebuilds the exact immutable commit under an explicit recipe, compares the reproduced artifact with the published artifact, and packages the resulting evidence for humans or AI agents.

The core trust boundary remains:

> **publisher artifact vs independent rebuild — verified from canonical evidence, not from mutable application state**

## Proven foundation

- M1–M5 are complete and merged.
- Real 0G Sandbox reproduction, proof-verified Storage, and Aristotle mainnet anchoring are proven.
- The M5 Aristotle registry remains deployed at `0xeD2361a6B56dc0d4a7494F3a46BA47f352050BA4`.
- M5 record `0xef2c77f9c39b77ce12328a404afcde9e935761a2d4fc9dfedff1f3b873f3ce4e` has exact verified readback.
- Durable final M5 mainnet evidence is `hackathon/m5-aristotle-mainnet.json`.
- M4's current TDX surface remains honestly classified as `PROVIDER_EVIDENCE_ONLY`; lack of artifact-digest binding is a capability boundary, not evidence of an operational failure.

## M6 product topology

M6 turns the milestone-oriented engineering topology into one understandable product runtime:

```text
Supabase     = mutable app/job memory
Railway      = ProofRail app/API + controlled workers
0G Sandbox   = independent build/execution
0G Storage   = durable canonical evidence
0G Aristotle = immutable compact commitment anchor
```

Supabase is explicitly **not** a proof authority. The M6 schema has no mutable verdict column. A stored/cached verification can display MATCH/MISMATCH only after the existing ProofRail core integrity checks accept it.

## What is implemented on `agent/m6-product-runtime`

- `packages/job-store` defines a database-independent verification job model and interface.
- Job pipeline states are `queued`, `running`, `verified`, and `failed`.
- Artifact kinds already reserve `software` and `agent-skill` without changing core correspondence semantics.
- A local in-memory store exists only for tests/smoke runs.
- A server-only Supabase PostgREST adapter uses `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`; no service-role secret belongs in browser code or database rows.
- `supabase/migrations/202608180001_m6_verification_jobs.sql` defines the RLS-enabled mutable job index and 0G evidence pointers.
- `apps/web` now supports product mode with `/health`, job create/read APIs, and job pages while preserving legacy evidence-viewer mode.
- If a job has cached `VerificationJson`, the page passes it through the same integrity-checked core renderer used by the prior viewer; database status cannot override the resulting verdict.
- Tests explicitly cover the rule that a database status of `verified` cannot turn a core `MISMATCH` into `MATCH`.
- M4 live inspection no longer exits non-zero merely because output/TEE binding is unavailable; it reports the weaker capability state in structured output.
- Draft PR #13 tracks M6.
- GitHub CI has passed the first full M6 test run.

## Railway transition

A new primary service, `proofrail-app`, has been created from `agent/m6-product-runtime` in explicit `PROOFRAIL_JOB_STORE=memory` smoke-test mode. Its intended runtime is `pnpm --filter @proofrail/web start`, with `/health` and `railway.product.json` pinned.

The first two deployments started before those explicit service settings had fully persisted and are being allowed to age out. A corrected fresh deployment is being validated. Do not retire historical milestone services until the corrected product runtime is actually healthy.

## Supabase gate

The connected Supabase account currently contains only the existing `goatmints_bot` project. ProofRail must get its **own** Supabase project rather than sharing Goatmints' database.

Creating a new Supabase project is gated on selecting the Supabase organization and confirming the provider-reported project cost. After that, M6 will apply the migration, run security/performance advisors, switch Railway from memory mode to Supabase, and prove persistent job create/read behavior.

## Agent Skills direction — M7

Issue #12 defines Agent Skills as the first new auditable artifact family.

ProofRail will keep two independent answers:

1. **Correspondence:** do the distributed skill package bytes match the package independently produced from the exact publisher-declared source commit? → `MATCH` / `MISMATCH`.
2. **Security audit:** what risky instructions/scripts/capabilities are present? → separate findings/severity report.

A `MATCH` must never mean “safe,” and a security finding must never rewrite the cryptographic correspondence result.

## Current blockers / gates

1. Prove the corrected `proofrail-app` Railway deployment passes `/health`.
2. User selects the Supabase organization for a dedicated ProofRail project; then confirm current Supabase project cost before creation.
3. Apply/validate Supabase schema and switch the product service to persistent storage.
4. Retire milestone-only Railway services after the product service is proven. Destructive deletion may require Railway dashboard 2FA.
5. Final M6 CI/merge, then begin M7 implementation.
