# Claude Code Handoff

Claude Code should treat this repository as an existing, proven system—not a greenfield rewrite.

## Start here

Before making meaningful changes, read these files in order:

1. `AGENTS.md`
2. `PROJECT_STATE.md`
3. `planning/current-sprint.md`
4. `CODEX.md`
5. `docs/13-m8-backend-blueprint.md`
6. `docs/14-source-authentication.md`
7. `docs/15-m8-api-inventory.md`
8. `docs/16-m8-database-plan.md`
9. `docs/17-m8-security-boundaries.md`
10. relevant existing architecture/trust/ADR files for the issue

Then read the **single GitHub issue** you are implementing and inspect the existing implementation before proposing changes.

`AGENTS.md` remains authoritative for coding-agent behavior and trust/product constraints. `CODEX.md` contains the active M8 execution order and detailed backend handoff; the same plan applies if Claude Code is used instead of Codex.

## Current state

- M1–M7 are complete, live-proven, and merged into `main`.
- M8 is now an explicit product milestone: AegisOne Hub / verified capability discovery.
- M8.1 capability/evidence/policy model is complete and merged in PR #20.
- M8.2 ARD adapter is the current implementation target, Issue #21, branch `agent/m8-ard-discovery`.
- Issues #22–#30 define the remaining backend sequence through the M8.11 backend freeze.
- M9 frontend is Issue #31 and must not begin until M8.11 explicitly declares the backend frontend-ready.
- Production intentionally remains exactly `proofrail-app` + `proofrail-worker`.

## M8 working sequence

Do one issue at a time:

1. M8.2 — pinned ARD adapter/local search (#21)
2. M8.3 — federated discovery (#22)
3. M8.4 — Supabase capability catalog (#23)
4. M8.5 — GitHub source authentication (#24)
5. M8.6 — Agent Skill verification enrichment (#25)
6. M8.7 — stable resource/evidence/policy API (#26)
7. M8.8 — MCP agent interface (#27)
8. M8.9 — controlled substitution end-to-end proof (#28)
9. M8.10 — MCP Registry indexing stretch (#29)
10. M8.11 — backend hardening/deploy/contract freeze (#30)
11. M9 frontend only after the backend freeze (#31)

Do not roll multiple milestones into one unbounded context/PR.

## Working method

For every issue:

1. Pull/read the latest project state and issue.
2. Restate explicit acceptance criteria.
3. Map the work onto current packages/services instead of rewriting working components.
4. Identify the affected trust boundary/external integration.
5. Use the pinned/researched integration contract in `docs/15-m8-api-inventory.md`; if a pin must change, explain and update tests/docs together.
6. Make the smallest coherent implementation.
7. Add success, failure, malformed-input, missing-evidence, and trust-escalation regression tests as applicable.
8. Run relevant package checks, then `pnpm check` and `pnpm test`.
9. Open/review PR; merge only with green CI and accurate claims.
10. Update project truth/evidence only for capabilities actually completed/proven.
11. Stop after the issue is merged.

## Verification commands

Use the repository-pinned toolchain:

```bash
pnpm install
pnpm check
pnpm test
```

Node.js 22+ and pnpm 10.15.0 are expected by the workspace.

Do not run live 0G/mainnet flows merely to prove ordinary code changes. Live funded work, paid services, large compute, or blockchain spending require the approval discipline defined in `AGENTS.md` and the issue.

## Non-negotiable AegisOne semantics

Preserve these distinctions everywhere—code, APIs, UI, tests, docs, and agent interfaces:

- `INDEXED` is discovery state, not verification.
- search relevance is not a trust/safety score.
- a repository existing is not proof that the publisher authorized it as source.
- source assurance is separate from source inspection and artifact correspondence.
- `DECLARED`, `REPOSITORY_AUTHENTICATED`, and `SIGNED_RELEASE` mean different things.
- `MATCH`/`MISMATCH` is deterministic and must not depend on an LLM.
- `MATCH` requires a distinct distributed artifact and independent exact-source reproduction.
- `MATCH` does not mean safe or malware-free.
- Agent Skill security findings are separate from correspondence.
- missing evidence never upgrades assurance.
- Supabase is mutable application/catalog/job memory, not proof authority.
- 0G-specific behavior stays behind adapters and does not contaminate provider-independent core/model packages.
- never claim TEE artifact/output binding unless live evidence actually binds the relevant digest.
- immutable source revisions use exact commit SHAs, not mutable branches.
- no public endpoint may expose the 0G signer or automatically spend 0G.
- no automatic installation/execution of discovered resources in M8.

## Architecture / cost guardrails

Reuse current topology:

- `proofrail-app`: public discovery/read/source-auth/policy/MCP surface.
- `proofrail-worker`: secret-bearing/internal verification and 0G operations.
- existing AegisOne Supabase project: mutable catalog/job/source-claim index.

Do not add a third permanent Railway service, runtime OpenAI/Anthropic API dependency, embeddings service, paid vector database, or new mainnet write without explicit approval.

## Completion standard

Do not report a task as complete until implementation, tests, documentation truth, deployment/evidence where required, and the issue acceptance criteria agree. If a capability cannot be proven, leave it explicitly unavailable/insufficient rather than inferring or marketing around the gap.
