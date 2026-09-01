# Current State

**Updated:** 2026-09-01  
**Product:** AegisOne  
**Current priority:** simplify the repository and reduce maintenance cost before adding more features.

## Production

- **Primary frontend/API:** Vercel — https://aegisone-three.vercel.app
- **Railway:** `aegisone-app` (parity/fallback) + `aegisone-worker` (privileged worker)
- **Database:** existing Supabase project for mutable catalog/job/source-claim state
- **0G signer:** worker only; never Vercel/browser/public app code

Some legacy compatibility identifiers such as the Railway-generated `proofrail-app-production.up.railway.app` domain, `PROOFRAIL_*` environment variables and already-deployed Supabase schema names still exist. Do not rename them casually; they are compatibility identifiers, not current branding.

## Product state

### Skills — live

- browsable catalog/library;
- federated discovery;
- real Agent Skill examples/fixtures;
- Evidence Passport links;
- unknown evidence renders as unknown/not established rather than being inferred.

### Audit — live

- Agent Skill deterministic audit / paste-to-scan;
- package/artifact verification for catalog resources with an exact immutable source revision;
- advisory 0G Compute path exists separately where configured;
- smart-contract audit: not implemented;
- MCP/agent-capability audit: not implemented.

### Verified — live

The UI keeps these states independent:

- `INDEXED` — discovered;
- `AUDITED` — deterministic audit completed;
- `VERIFIED` — genuine correspondence `MATCH` exists;
- `STORED ON 0G` — a validated publication exists.

A real funded 0G Galileo Storage publication was completed for **Playful Neo-Brutalist Web Design** and recorded in `hackathon/m10-0g-publication-evidence.json`:

- Storage root: `0x0e1d07db2978c791e24a5eb1ffa566ffb1f797fe280bc4bb40146ad9108d59e1`
- Storage transaction: `0x005c8b1ae4640f3f1d9db3eff64ab96d63f5b83cd7bceddc6b39047190578437`
- Canonical evidence SHA-256: `fcff2567d995c13e715807d781f61788808f73adbfc7f27c5ecf7878c28403af`
- Exact-byte readback proof: true
- New chain registry commitment: **not made**; correspondence for that resource is `NOT_EVALUATED`.

Older M5/M7 live 0G evidence remains under `hackathon/` and is historical truth.

### For Agents — live

MCP exposes exactly:

- `aegisone_search`
- `aegisone_inspect`
- `aegisone_evaluate`
- `aegisone_scan`

REST exposes discovery, scan, package verification, resource/evidence reads and deterministic policy evaluation. Publishing remains privileged/operator-controlled.

## Hard boundaries

- `MATCH` / `MISMATCH` is deterministic.
- Source-only inspection never earns correspondence.
- `MATCH` does not mean safe.
- Deterministic security audit and 0G Compute advisory output stay separate.
- Search/category metadata cannot upgrade trust.
- Supabase cannot manufacture evidence.
- Missing evidence is never filled in for presentation.
- TEE/provider evidence must not be described as artifact-output binding unless it actually binds the relevant digest.
- Funded 0G work or mainnet writes require explicit approval.

## Repository cleanup direction

The current code still has too many small workspace packages and a large `apps/web` surface. New work should move toward five understandable domains rather than creating more packages:

1. **core** — resource/evidence/policy/hash semantics;
2. **audit** — skill scan, reproduction and correspondence;
3. **discovery** — ARD and discovery providers;
4. **data** — Supabase catalog/job persistence;
5. **zerog** — Storage, Compute, Sandbox, registry and evidence publication.

Do this incrementally and preserve behavior/tests. Historical M5/M7 run code should stop participating in ordinary product work once it can be removed safely; immutable evidence stays in `hackathon/`.

## Workflow

No issue/PR/milestone workflow by default. Work directly on `main`, run relevant tests, let CI verify the push, and keep this file limited to **current truth only**. Git history is the project history.
