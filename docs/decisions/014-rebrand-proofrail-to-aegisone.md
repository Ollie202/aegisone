# ADR-014 — Rebrand ProofRail to AegisOne, keep live infra identifiers unchanged

## Status

Accepted, 2026-08-26.

## Context

The repo owner renamed the GitHub repository from `Ollie202/proofrail-0g` to `Ollie202/aegisone` and
decided the product's working name changes from "ProofRail" to "AegisOne" (see
`research/brand-risk.md`, which records that an unrelated third-party GitHub org already uses the
`ProofRail`/`proofrail` name — a naming collision this rebrand resolves for the working name, though
final long-term naming was never fully closed out).

This is a full mechanical rebrand: npm package scope, branding text, and Supabase Edge Function
folder names. It is explicitly not a logic change — no test's behavioral assertion (MATCH/MISMATCH,
ALLOW/REVIEW/DENY, trust-level semantics) changes, only cosmetic identifiers and the import paths
needed to keep the build compiling.

This environment has no Railway or Supabase credentials (the same constraint noted throughout every
M8 milestone in `PROJECT_STATE.md`), so nothing about the actual live deployment can be changed here
— only the repository's source of truth.

## Decision

1. **npm package scope:** every workspace package's `package.json` `"name"` changes from
   `@proofrail/<name>` to `@aegisone/<name>`, and every import/dependency reference across the
   monorepo (including the `pnpm --filter` commands baked into `railway.product.json`,
   `railway.m5.aristotle-preflight.json`, `railway.m5.aristotle-write.json`) is updated to match —
   this part is not optional, since a stale `@proofrail/*` filter or import would simply fail to
   resolve against the renamed packages.
2. **Root `package.json` name:** `proofrail-workspace` → `aegisone`.
3. **Branding text:** "ProofRail" → "AegisOne" everywhere it names the product, across docs, ADRs,
   planning notes, UI copy, and cosmetic string/comment literals (including the `"service"` field in
   both apps' `/health` JSON, the CLI binary name, the MCP server name and its three tool names
   `proofrail_search`/`proofrail_inspect`/`proofrail_evaluate` → `aegisone_search`/
   `aegisone_inspect`/`aegisone_evaluate`, and the `org.proofrail.*` ARD metadata namespace →
   `org.aegisone.*`).
4. **Supabase Edge Function folders:** `supabase/functions/proofrail-catalog` and
   `supabase/functions/proofrail-jobs` are renamed to `supabase/functions/aegisone-catalog` and
   `supabase/functions/aegisone-jobs`, and the two app-side callers
   (`packages/catalog-store/src/supabase.ts`, `packages/job-store/src/supabase.ts`) now call
   `/functions/v1/aegisone-catalog` and `/functions/v1/aegisone-jobs` to match.
5. **Contract source:** `contracts/src/ProofRailRegistry.sol` → `contracts/src/AegisOneRegistry.sol`
   (contract `ProofRailRegistry` → `AegisOneRegistry`), matching test file renamed to
   `contracts/test/AegisOneRegistry.test.js`.
6. **Example fixture directory:** `examples/hello-proofrail` → `examples/hello-aegisone`, with every
   local import path in the repo updated to match.

## What is deliberately left unchanged, and why

- **Railway service names** `proofrail-app` and `proofrail-worker` — these are the actual live
  Railway service names in production today. Renaming them here without renaming the live services
  (which this environment has no credentials to do) would make the docs describe infrastructure that
  does not exist and would not affect the real deployment at all. Every code/doc reference to these
  two literal service names is preserved exactly, including the Railway *project* name
  (`proofrail-0g`, referenced in `docs/15-m8-api-inventory.md` and
  `docs/23-m8-11-production-readiness.md`) which is a separate live identifier from the GitHub repo of
  the same pre-rename name.
- **The production URL** `https://proofrail-app-production.up.railway.app` — the real, unchanged live
  URL, including inside `packages/discovery-ard/src/constants.ts`'s
  `AEGISONE_ARD_REGISTRY_IDENTIFIER` URN (only the constant's *name* was rebranded; its literal value
  still embeds this real URL and must not change).
- **Every `PROOFRAIL_*` environment variable name** (`PROOFRAIL_SUPABASE_APP_TOKEN`,
  `PROOFRAIL_JOB_STORE`, `PROOFRAIL_WORKER_INTERNAL_TOKEN`, `PROOFRAIL_CATALOG_STORE`,
  `PROOFRAIL_PUBLIC_BASE_URL`, `PROOFRAIL_ARISTOTLE_*`, and the M7 live-run script's
  `PROOFRAIL_M7_SOURCE_COMMIT`/`PROOFRAIL_M7_GALILEO_WRITE`) — these are real configured Railway
  environment variable names (or, for the M7 ones, the documented invocation contract for an
  approval-gated live script); renaming them in code without renaming them in the actual Railway
  environment would silently break the app the next time it deploys.
- **The `x-proofrail-app-token` HTTP header name** the app sends to the (still-`proofrail`-named,
  not-yet-redeployed) Supabase Edge Functions, and the live-deployed database schema/function/table
  names in `supabase/migrations/*.sql` (`proofrail_private`, `proofrail_app_auth`,
  `proofrail_job_create`/`_get`/`_list`/`_update`, and the `raise exception 'invalid ProofRail app
  token'` message text) — these migrations have already been applied to the live Supabase project.
  Editing the migration files would not change the already-applied live schema/function/error text at
  all, so `supabase/migrations/` is left completely untouched (not even the pure prose comments) to
  keep the file exactly matching what is actually deployed until the repo owner runs a real, separate
  migration to rename these live objects.
- **Historical/pinned-commit evidence.** Several M3–M5 live runs are already-completed, already
  recorded facts anchored to an exact immutable commit SHA (`e9c82277c...`) or an already-deployed
  mainnet contract address — `docs/decisions/009-m4-sandbox-tapp-boundary.md`, `research/research-log.md`,
  `README.md`, `hackathon/requirements-matrix.md`, `planning/budget.md`, and the live-run scripts'
  hard-coded `examples/hello-proofrail/...` paths (`packages/m5-flow/scripts/run-live.ts`,
  `packages/sandbox-0g/scripts/run-live.ts`). These describe what the repository actually looked like,
  and what was actually deployed under what name, at the time those specific runs happened — before
  this rename. They are left saying `ProofRail`/`hello-proofrail`/`ProofRailRegistry` where they
  describe that historical, unchangeable state, with an inline note added where a reader might
  otherwise assume the current source layout. Purely cosmetic, non-hash-affecting labels inside the
  same live scripts (a scratch temp-directory path, a display name for a throwaway sandbox instance)
  were still renamed, since those do not describe anything that was actually checked out or recorded.
- **`hackathon/*.json` evidence values**, and the one field that is a real recorded technical format
  identifier rather than a pure cosmetic label: `packageFormat`/`format: "proofrail-agent-skill-package-v1"`
  (`packages/skill-audit/*`, `packages/m7-flow/*`, `packages/skill-verification-link/src/distribution-fetch.ts`,
  `hackathon/m7-live-evidence.json`, `hackathon/evidence.md`) and the M5 mainnet preflight action label
  `"action": "DEPLOY_PROOFRAIL_REGISTRY"` (`hackathon/m5-aristotle-preflight.json`,
  `packages/m5-flow/scripts/pre-mainnet.ts`) — both are left exactly as recorded, since they are not
  confidently just branding chrome and the instruction for this rebrand was to leave a hackathon
  evidence value alone whenever there is doubt about whether it is cosmetic.
- **`research/brand-risk.md`'s third-party reference** — this document is *about* a real, unrelated
  external GitHub org/repo that happens to already be named `ProofRail`/`proofrail`. That third-party
  name is preserved (a blind text rename had briefly corrupted it into claiming an org called
  "AegisOne" owns that unrelated repo, which was wrong and has been fixed); only this repository's own
  former working name in the surrounding prose was updated.
- **`examples/hello-aegisone/fixture.ts`, `build.mjs`, `package.json`, `README.md`, and the checked-in
  `fixtures/publisher/hello-proofrail.json`** keep their internal `hello-proofrail`-branded file names,
  `fixture@proofrail.invalid` addresses, and `hello from ProofRail` artifact content unchanged (only
  the containing directory was renamed). This fixture's determinism depends on every one of these
  pieces staying byte-for-byte mutually consistent (the recipe's `artifactPath`, the build script's
  output filename, and the checked-in publisher artifact's exact bytes all have to agree, or the
  MATCH/MISMATCH comparison this fixture exists to demonstrate breaks); renaming all of them together
  was judged unnecessary risk for a purely internal test fixture with no external contract.

## Consequences

Positive:

- the package scope, root name, branding text, and Edge Function folder names are now consistent with
  the renamed GitHub repository, with no dangling `@proofrail/*` import or dependency anywhere in the
  monorepo;
- every ADR/doc/comment describing a still-live, not-yet-renamed piece of infrastructure keeps
  matching that infrastructure's actual current name, rather than drifting into inaccurate docs;
- `pnpm check`/`pnpm test` are green apart from the two pre-existing, unrelated `packages/cli`/
  `packages/runner-local` fixture failures already present on `main` before this change (confirmed by
  running the same two tests against the pre-rebrand tree).

Trade-offs / follow-up required from the repo owner:

- the live Supabase project still has the Edge Functions deployed under the old
  `proofrail-catalog`/`proofrail-jobs` names; `packages/catalog-store`/`packages/job-store` now call
  the new `aegisone-catalog`/`aegisone-jobs` URLs, so those calls will 404 in production until the
  repo owner redeploys the renamed functions from this branch;
- the live Supabase schema (`proofrail_private`, `proofrail_app_auth`, `proofrail_job_*` functions)
  and the live Railway service/env-var names are unchanged by design — if the repo owner wants those
  renamed too, that requires a separate, explicitly-approved live migration/Railway change with real
  credentials, outside what this environment can do;
- final long-term product naming was never fully resolved before this rebrand (see
  `research/brand-risk.md`); "AegisOne" is adopted here as the repo owner's current working name, not
  a claim that naming research is closed.
