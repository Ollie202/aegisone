# Codex Handoff — ProofRail M8 Backend

Treat this repository as an existing proven system. Do not rewrite M1–M7 or replace the trust model.

## Read first

1. `AGENTS.md` — authoritative coding-agent rules.
2. `PROJECT_STATE.md` — current proven state.
3. `planning/current-sprint.md`.
4. `docs/13-m8-backend-blueprint.md`.
5. `docs/14-source-authentication.md`.
6. `docs/15-m8-api-inventory.md`.
7. `docs/16-m8-database-plan.md`.
8. `docs/17-m8-security-boundaries.md`.
9. `docs/03-architecture.md`, `docs/11-trust-model.md`, and relevant ADRs.
10. The GitHub issue for the single milestone you are implementing.

## Current M8 state

- M1–M7: complete, merged, live-proven.
- M8.1 capability/evidence/policy model: complete and merged in PR #20.
- M8.2 ARD adapter: implemented and locally green on Issue #21 branch `agent/m8-ard-discovery`; PR CI/merge gate pending.
- The backend MVP must be completed before the new Hub frontend is layered on top.

## Backend sequence

Implement one issue at a time, in this order:

1. M8.2 — pinned ARD adapter and local search — implemented on issue branch; merge gate pending.
2. M8.3 — federated discovery adapters.
3. M8.4 — Supabase catalog persistence.
4. M8.5 — source authentication / source claims.
5. M8.6 — connect discovered Agent Skills to existing ProofRail verification.
6. M8.7 — stable public read API + deterministic policy endpoint.
7. M8.8 — MCP interface for agents.
8. M8.9 — controlled substitution end-to-end demo.
9. M8.10 — MCP Registry indexing after the core Skill flow works.
10. M8.11 — backend hardening, deployment, evidence, documentation.

Do not begin M9/frontend work until the M8 backend acceptance path is green.

## Core product flow

`intent -> discovery -> normalized capability -> source assurance -> ProofRail evidence -> consumer policy -> ALLOW/REVIEW/DENY`

Discovery answers what may be useful. ProofRail evidence answers what was actually observed. Consumer policy decides whether that evidence is sufficient for a particular agent/user.

## Non-negotiable distinctions

- `INDEXED` is not `VERIFIED`.
- Search relevance is not a trust score.
- A repository existing does not authenticate that it is the publisher-approved source.
- `DECLARED`, `REPOSITORY_AUTHENTICATED`, and `SIGNED_RELEASE` are distinct source-assurance levels.
- Source inspection is not distribution correspondence.
- `MATCH` requires a distinct distributed artifact digest and an independently reproduced digest from the exact claimed source commit.
- `MATCH` never means safe.
- Security audit findings never rewrite correspondence.
- Missing evidence must remain missing; do not infer it.
- Supabase is mutable application/catalog memory and may not create proof.
- No LLM output may influence correspondence or policy evaluation.
- No public route may hold or exercise the 0G signer.
- No automatic installation/execution of discovered Skills or MCP resources.

## Architecture to preserve

Production remains exactly two Railway services:

- `proofrail-app`: public HTTP/ARD/read surface, GitHub source-claim web flow, catalog/search access.
- `proofrail-worker`: secret-bearing/internal execution boundary for expensive verification and 0G writes.

Supabase remains the shared mutable job/catalog index. 0G Sandbox remains independent execution. 0G Storage remains canonical evidence storage. The existing registry remains the compact commitment layer.

Do not add a third permanent service unless an acceptance criterion cannot be satisfied otherwise and the user explicitly approves the architecture change.

## External contracts are pinned/researched

See `docs/15-m8-api-inventory.md` for exact endpoints and immutable upstream references. In particular:

- ARD v0.9 draft is pinned to `ards-project/ard-spec@1d25abcf07e081f604dba3ae5398b16c79f20b7b`.
- GitHub Agent Finder contract reference: `ards-project/ard-connectors@53cc4f3a4596cf51482fabeb554d124ca248ed07`.
- Hugging Face Discover reference: `huggingface/hf-discover@49c927439fcaa8f210cfd42186c0641acef579fa`.
- MCP Registry reference: `modelcontextprotocol/registry@6036804f1c62633b5e7d2927f411a6f4127f148a`; use stable `/v0.1/` reads.
- GitHub REST calls should send `X-GitHub-Api-Version: 2026-03-10` where applicable.

Do not silently switch a pinned contract to upstream `main` while implementing a milestone. If a pin must change, document the reason in the PR and update tests/docs together.

## GitHub source-authentication MVP

The GitHub App/source-claim mechanism is specified in `docs/14-source-authentication.md`.

Important implementation constraint: public-repository M8 does not require storing a GitHub user token long-term and does not require a GitHub App private key for the basic claim flow. Use the short-lived GitHub App user authorization flow, inspect the authenticated user's app installations/repositories and effective repository permission, record the stable repository ID plus exact commit claim, then discard the token after the claim/session window. Require effective write/push or admin-equivalent repository authority for `REPOSITORY_AUTHENTICATED`.

`SIGNED_RELEASE` is a stronger optional evidence path and must only be emitted after cryptographic attestation verification, not after merely listing an attestation from GitHub.

## Working method

For each issue:

1. Pull latest `main` and create/use the issue branch.
2. Read the issue and relevant docs.
3. Inspect existing packages before adding new ones.
4. Restate acceptance criteria in the PR.
5. Implement the smallest provider-independent change possible.
6. Add success, malformed-input, missing-evidence, and trust-escalation regression tests.
7. Run package tests, then `pnpm check` and `pnpm test`.
8. Open a draft PR early if useful.
9. Do not merge until CI is green and trust claims match observed behavior.
10. Update `PROJECT_STATE.md` only for capabilities actually completed/proven.
11. Stop after the issue is merged; do not roll into the next milestone in the same context.

## Cost guardrail

M8 is designed to require no OpenAI API, Anthropic API, embedding API, paid vector DB, or additional permanent Railway service. Do not introduce one without explicit user approval.

Do not run live funded 0G work merely to test ordinary code. Local/unit/integration fixtures first; live verification only at the milestone that explicitly requires end-to-end evidence.

## Definition of backend MVP success

A client can search real agentic resources, inspect a ProofRail-verified Agent Skill, see independently authenticated source/evidence dimensions, apply a deterministic policy, and obtain `ALLOW`, `REVIEW`, or `DENY`. A controlled substituted distribution with unchanged claimed identity/source must produce `MISMATCH` and fail a policy that requires `MATCH`. The underlying canonical evidence must remain independently inspectable through the existing 0G path.
