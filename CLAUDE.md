# Claude Code Handoff

Claude Code should treat this repository as an existing, proven system—not a greenfield rewrite.

## Start here

Before making meaningful changes, read these files in order:

1. `AGENTS.md`
2. `PROJECT_STATE.md`
3. `planning/current-sprint.md`
4. `docs/01-prd.md`
5. `docs/03-architecture.md`
6. `docs/11-trust-model.md`
7. relevant ADRs, security docs, and integration docs for the task

Then inspect the existing implementation before proposing changes.

`AGENTS.md` is authoritative for coding-agent behavior and trust/product constraints. Do not duplicate or weaken its rules.

## Current state

- M1–M7 are complete, live-proven, and merged into `main`.
- The technical submission package and judge-facing proof surface are complete.
- Production is intentionally limited to `proofrail-app` and `proofrail-worker`.
- There is currently no M8. Do not invent a new milestone without an explicit product goal.
- Remaining submission work described in `planning/current-sprint.md` is user-authenticated/media work unless the user explicitly changes scope.

## Working method

For every new implementation request:

1. Restate the requested outcome as explicit acceptance criteria.
2. Map it onto the current architecture instead of rebuilding existing components.
3. Identify which trust boundary or external integration is affected.
4. Check current official documentation for any evolving external dependency before changing integration code.
5. Make the smallest coherent change that satisfies the requirement.
6. Add or update tests for both success and failure paths.
7. Run the relevant package tests, then run the repository-wide checks before declaring completion.
8. Update project documentation only when project truth actually changes.
9. Record real live-integration evidence in `hackathon/evidence.md` when applicable.

## Verification commands

Install and use the repository-pinned toolchain:

```bash
pnpm install
pnpm check
pnpm test
```

Node.js 22+ and pnpm 10.15.0 are expected by the workspace.

Do not run live 0G/mainnet flows merely to prove local code changes. Live runs, paid services, large compute, or blockchain spending require the same approval discipline defined in `AGENTS.md` and project docs.

## Non-negotiable ProofRail semantics

Preserve these distinctions everywhere—code, APIs, UI, tests, and docs:

- deterministic artifact correspondence is `MATCH` / `MISMATCH` and must not depend on an LLM;
- source identity/assurance is separate from artifact correspondence;
- `MATCH` does not mean safe or malware-free;
- Agent Skill security findings are separate from correspondence;
- Supabase is mutable application/job memory, not proof authority;
- 0G-specific behavior stays behind adapters and does not contaminate `packages/core`;
- never claim TEE artifact/output binding unless the live attestation actually binds the relevant digest;
- immutable source revisions must use commit SHAs, not mutable branch names, as security claims.

## When the user asks for a new feature

Do not assume the old hackathon milestone sequence is the roadmap. First determine whether the request is:

- a product feature on top of the completed M1–M7 foundation;
- a hardening/refactor task;
- a new artifact family;
- a deployment/infrastructure change;
- or a new hackathon/submission requirement.

Create a new issue/milestone only when that classification and acceptance criteria are clear.

## Completion standard

Do not report a task as complete until implementation, tests, documentation truth, and required evidence agree with each other. If a capability cannot be proven, label it unavailable instead of inferring or marketing around the gap.
