# Current Sprint — M6 Product Runtime

## Primary objective

Turn the proven M1–M5 verification engine into one understandable product runtime without moving ProofRail's trust into a mutable database.

## Proven foundation — M1–M5

- [x] M1 provider-independent deterministic verification core and MATCH/MISMATCH.
- [x] M2 real proof-verified 0G Storage round trip.
- [x] M3 minimal registry contract/client and Galileo deployment/readback.
- [x] M4 real hosted 0G Sandbox execution plus precise `PROVIDER_EVIDENCE_ONLY` TDX boundary.
- [x] M5 real end-to-end Galileo reproduction + Storage + independently verified Aristotle mainnet anchor.

## M6 — Issue #11

- [x] Define database-independent verification-job lifecycle (`queued`, `running`, `verified`, `failed`).
- [x] Keep pipeline status separate from cryptographic correspondence; no mutable database `verdict` field.
- [x] Add server-only Supabase PostgREST adapter.
- [x] Add RLS-enabled `verification_jobs` migration with ownership fields and 0G evidence pointers.
- [x] Add in-memory store for local/CI smoke tests only.
- [x] Turn `apps/web` into a product runtime with `/health`, job create/read API, and job pages.
- [x] Require cached verification JSON to pass the existing integrity-checked core renderer before MATCH/MISMATCH is displayed.
- [x] Add tests proving database pipeline status cannot override a core MISMATCH.
- [x] Change M4 inspection so an expected missing output/TEE binding is a capability limitation, not an operational Railway crash.
- [x] Create/stage the primary Railway `proofrail-app` service in explicit memory smoke-test mode.
- [ ] Prove a corrected `proofrail-app` Railway deployment passes `/health`.
- [ ] Create a dedicated ProofRail Supabase project in the user-selected Supabase organization after cost confirmation.
- [ ] Apply migration; run Supabase security and performance advisors.
- [ ] Switch `proofrail-app` from memory mode to real Supabase and prove create/read job persistence.
- [ ] Consolidate/remove milestone-only Railway services after the product runtime is proven; preserve GitHub/0G evidence.
- [ ] Final docs/CI, mark PR #13 ready, merge, and close Issue #11.

## M7 — Issue #12 queued next

Agent Skills become a first-class artifact family with two independent outputs:

1. **Provenance/correspondence:** do the distributed skill bytes match the exact publisher-declared source commit? This remains normal ProofRail `MATCH` / `MISMATCH`.
2. **Skill security audit:** what risky instructions, scripts, dependencies, exfiltration paths, destructive operations, or hidden payloads exist? This is a separate report and never rewrites the correspondence result.

The UI must be able to show combinations such as `MATCH + HIGH-RISK FINDINGS` and `MISMATCH + NO FINDINGS`.

## Infrastructure hygiene

- [x] Aristotle execution tokens cleared after M5.
- [x] M3/M4 temporary branch/config handoffs restored after M5.
- [ ] Delete the previously staged disposable `m5-aristotle-anchor-temp` service; Railway requires dashboard 2FA to finalize destructive deletion.
- [ ] Retire M2/M3/M4/M5 milestone Railway boxes only after `proofrail-app` is the proven replacement topology.

## Explicitly out of scope for M6

- payments/billing;
- arbitrary enterprise RBAC;
- private repository support;
- changing the M1–M5 trust model;
- implementing M7 security rules before the M6 product runtime is stable.
