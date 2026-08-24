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

Stop gate:

- complete CI + Gitleaks green;
- Supabase advisors clean/reviewed;
- Railway services healthy;
- `proofrail-app` has no 0G signer;
- public endpoints cannot trigger unauthorized 0G spend;
- SSRF/package/OAuth tests complete;
- public JSON/API contract documented/frozen;
- deployment watch paths include every M8 package;
- project state reconciled;
- backend ready for M9 frontend.

## M9 — frontend Hub

Only start after M8.11/backend freeze.

See `docs/18-m9-frontend-plan.md`.
