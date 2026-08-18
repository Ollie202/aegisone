# Current Sprint — M6 Product Runtime

## Primary objective

Turn the proven M1–M5 verification engine into one understandable product runtime without moving ProofRail's trust into a mutable database.

## M6 — Issue #11 — COMPLETE

- [x] Define database-independent verification-job lifecycle (`queued`, `running`, `verified`, `failed`).
- [x] Keep pipeline status separate from cryptographic correspondence; no mutable database `verdict` field.
- [x] Add RLS-enabled Supabase job schema with ownership fields and 0G evidence pointers.
- [x] Keep privileged Supabase DB access inside the authenticated `proofrail-jobs` Edge Function; Railway does not hold a service-role secret.
- [x] Add in-memory store for local/CI smoke tests only.
- [x] Turn `apps/web` into a product runtime with `/health`, job create/read API, and job pages.
- [x] Require cached verification JSON to pass the existing integrity-checked core renderer before MATCH/MISMATCH is displayed.
- [x] Add tests proving database pipeline status cannot override a core MISMATCH.
- [x] Change M4 inspection so an expected missing output/TEE binding is a capability limitation, not an operational Railway crash.
- [x] Create a dedicated ProofRail Supabase project after provider cost confirmation (`$0/month` in the current organization).
- [x] Apply migrations and finish with a clean Supabase security advisor; performance advisor only reports expected unused-index informational notices on the new table.
- [x] Deploy `proofrail-app` on Railway, switch it to real Supabase persistence, and pass `/health`.
- [x] Prove a live app → Edge Function → Supabase round trip by creating/reading job `085e2667-c2ca-4d98-919b-106eb2ff4334` and independently confirming the same row with SQL.
- [x] Add and prove `proofrail-worker` as the long-term secret boundary. Startup confirms signer configured and public signing disabled.
- [x] Preserve the funded signer as a Railway project-level shared secret; do not expose or copy the private key.
- [x] Make root `railway.json` service-neutral so future services cannot accidentally inherit the old M2 live command.
- [x] Stage removal of all five milestone-only M2/M3/M4/M5 Railway services after app + worker replacement topology is proven.
- [x] Preserve all historical GitHub/0G evidence independently of Railway cleanup.
- [x] Final completed-head CI passes before merge.
- [ ] Apply the already-staged legacy-service deletions in the Railway dashboard; Railway requires interactive 2FA and the connector cannot complete this destructive confirmation.
- [ ] Mark PR #13 ready, squash-merge, and confirm Issue #11 closes.

## Target product topology

```text
proofrail-app    -> API/UI + Supabase-backed mutable job index
proofrail-worker -> controlled worker + shared signer boundary; no public signing endpoint
0G Sandbox       -> independent execution
0G Storage       -> durable canonical evidence
0G Aristotle     -> immutable compact commitments
```

## M7 — Issue #12 queued next

Agent Skills become a first-class artifact family with two independent outputs:

1. **Provenance/correspondence:** do the distributed skill bytes match the exact publisher-declared source commit? This remains normal ProofRail `MATCH` / `MISMATCH`.
2. **Skill security audit:** what risky instructions, scripts, dependencies, exfiltration paths, destructive operations, or hidden payloads exist? This is a separate report and never rewrites the correspondence result.

The UI must be able to show combinations such as `MATCH + HIGH-RISK FINDINGS` and `MISMATCH + NO FINDINGS`.
