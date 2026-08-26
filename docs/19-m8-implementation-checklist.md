# M8 Implementation Checklist / Stop Gates

This file is intentionally operational. Coding agents should use the GitHub issue as the authoritative scope for each milestone and use this file as the sequence/stop gate.

## M8.1 — capability/evidence/policy model

Status: **COMPLETE / merged PR #20**.

Do not redo.

## M8.2 — ARD adapter

Issue: #21  
Branch: `agent/m8-ard-discovery`

Stop gate:

- local/pinned ARD catalog/search implemented;
- no federation yet;
- all four resource kinds tested;
- indexed metadata cannot escalate trust;
- root tests green;
- merge, update state, stop.

## M8.3 — federated discovery

Stop gate:

- GitHub Agent Finder adapter real/live-smoke-tested;
- Hugging Face adapter real/live-smoke-tested or explicitly deferred with GitHub provider complete;
- normalized/deduplicated/source-balanced results;
- provider timeout/outage isolation;
- no provider result labeled ProofRail-verified without ProofRail evidence;
- tests green;
- merge, stop.

## M8.4 — Supabase catalog persistence

Stop gate:

- migrations committed/applied after review;
- RLS enabled;
- resource/discovery/version/ingestion storage implemented;
- stable resource IDs/dedup tested;
- database-only state cannot manufacture trust evidence;
- Supabase advisors reviewed after apply;
- tests green;
- merge, stop.

## M8.5 — source authentication

Stop gate:

- real GitHub App created by user and credentials configured;
- OAuth user authorization flow works;
- repository effective write/admin authority checked;
- stable repo ID + exact commit recorded;
- canonical source claim/digest implemented;
- read-only user cannot upgrade assurance;
- source claim history immutable/superseding;
- no tokens in DB/logs;
- `REPOSITORY_AUTHENTICATED` proven with real account/repository;
- tests green;
- merge, stop.

`SIGNED_RELEASE` is optional. If not cryptographically verified, leave unavailable.

## M8.6 — verification enrichment

Stop gate:

- discovered Agent Skill version can link to exact source claim;
- source-only inspection remains non-correspondence;
- distinct distribution required for MATCH/MISMATCH;
- existing M7 package/audit logic reused;
- worker/admin authorization protects expensive runs;
- canonical evidence pointers returned through normalized capability model;
- tests green;
- merge, stop.

## M8.7 — stable read API + policy

Stop gate:

- versioned resource/evidence read routes stable;
- policy endpoint uses M8.1 evaluator only;
- missing evidence fail/review semantics tested;
- JSON documented;
- no HTML scraping needed by agents;
- tests green;
- merge, stop.

## M8.8 — MCP agent interface

Stop gate:

- `proofrail_search` works;
- `proofrail_inspect` works;
- `proofrail_evaluate` works;
- tools wrap same services as REST;
- no install/execute/sign tool;
- one real Codex/Claude compatible client can query it;
- tests green;
- merge, stop.

## M8.9 — controlled substitution vertical slice

Stop gate:

- real repository-authenticated Skill claim;
- genuine distinct distribution artifact;
- genuine independent 0G reproduction => MATCH;
- controlled tampered distribution retains public identity/source claim but bytes differ => MISMATCH;
- policy requiring MATCH gives genuine ALLOW and substituted DENY;
- canonical evidence stored/retrieved through 0G;
- evidence ledger updated;
- repeatable demo command/path documented;
- merge, stop.

This gate defines the backend MVP.

## M8.10 — MCP Registry indexing

Stretch only after M8.9.

Stop gate:

- official `/v0.1/servers` ingestion;
- incremental sync/cursor support;
- MCP resources labeled INDEXED unless actual stronger evidence exists;
- no fabricated source correspondence;
- tests green;
- merge, stop.

## M8.11 — backend hardening/freeze

Status: **code/contract complete on `agent/m8-11-backend-freeze`** (Issue #30); production
deployment verification deferred to the repo owner (`docs/23-m8-11-production-readiness.md`).

Stop gate:

- [x] complete CI + Gitleaks green (root `pnpm check`/`pnpm test`; CI's `gitleaks/gitleaks-action@v3` unmodified);
- [ ] Supabase advisors clean/reviewed — deferred, needs repo-owner Supabase access (`docs/23-m8-11-production-readiness.md` item 2);
- [ ] Railway services healthy — deferred, needs repo-owner Railway access (item 3);
- [x] `proofrail-app` has no 0G signer — confirmed by static check (no `ZEROG_*` reference, no `packages/sandbox-0g`/`storage-0g`/`registry-0g` dependency anywhere in `apps/web`);
- [x] public endpoints cannot trigger unauthorized 0G spend — confirmed by static check plus the existing/extended regression suite (`apps/web/test/m8-11-hostile-full-stack.test.ts`, `apps/web/test/m8-9-substitution-demo.test.ts`);
- [x] SSRF/package/OAuth tests complete — reused from M8.5/M8.6, confirmed still green, cited in `docs/24-m8-11-contract-freeze.md`'s closure table;
- [x] public JSON/API contract documented/frozen — `docs/24-m8-11-contract-freeze.md` (index) plus a new response-shapes section in `docs/14-source-authentication.md`;
- [ ] deployment watch paths include every M8 package — deferred, needs repo-owner Railway dashboard access to confirm current config (item 5); the required package list is documented;
- [x] project state reconciled — `PROJECT_STATE.md`/`planning/current-sprint.md` M8.5-M8.10 headers corrected from stale "merge gate pending" to "COMPLETE" (all confirmed merged via `git log`), M8.11 section added;
- [x] backend ready for M9 frontend — declared conditionally: the **code/contract** is frontend-ready; production health/Supabase/GitHub-App items remain outstanding per `docs/23-m8-11-production-readiness.md` and do not block M9 code from starting against the frozen contract.

## M9 — frontend Hub

Only start after M8.11/backend freeze.

See `docs/18-m9-frontend-plan.md`.
