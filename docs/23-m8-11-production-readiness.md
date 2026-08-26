# M8.11 — Production readiness checklist

Status: **the code/contract side of M8.11 is complete**; every item below requires repo-owner
credentials/access this agent environment does not have (no Railway CLI/API token, no Supabase
project credentials, no ability to reach live production health endpoints or the Supabase
dashboard). This document exists so that gap is explicit and actionable rather than inferred away
or silently marked done — the same discipline used in every M8.4–M8.10 report in `PROJECT_STATE.md`.

Dated 2026-08-26. Re-run this checklist (or update its dates) whenever a new migration or
Railway-affecting change merges to `main` after this issue.

## 1. Apply the four pending Supabase migrations

None of the M8.4–M8.7 migrations have been applied to the production Supabase project yet. Apply
them **in order** (each is additive/backward-compatible with the one before it):

```text
supabase/migrations/202608260001_m8_4_capability_catalog.sql   (agentic_resources, resource_discoveries, resource_versions, ingestion_sources)
supabase/migrations/202608260002_m8_5_source_claims.sql        (source_claims, source_claim_authority_observations)
supabase/migrations/202608260003_m8_6_capability_verifications.sql (capability_verifications)
supabase/migrations/202608260004_m8_7_source_snapshot_digest.sql   (adds capability_verifications.source_snapshot_sha256)
```

Command (from a machine with the real Supabase project credentials):

```bash
supabase link --project-ref <the AegisOne project ref>
supabase db push
```

Or apply each file's SQL directly in the Supabase dashboard's SQL editor, in the order listed
above, if `supabase db push` is not available.

**Verification after applying:** confirm all eight `public` tables now exist
(`verification_jobs`, `proofrail_app_auth` from before M8, plus the four above) and that RLS is
enabled with a `deny to anon, authenticated` policy on each of the four new tables (every M8
migration follows this convention; the migration files themselves are the source of truth for the
expected policy names).

## 2. Review the Supabase security and performance advisors

After applying the migrations above, open the Supabase dashboard for the AegisOne project:

```text
https://supabase.com/dashboard/project/<project-ref>/advisors/security
https://supabase.com/dashboard/project/<project-ref>/advisors/performance
```

Confirm:

- no new security advisor warning is introduced by the four M8 tables (expected: none, since every
  table denies both `anon` and `authenticated` roles by policy — the only access path is the
  service-role-only `aegisone-catalog` Edge Function);
- no missing-index/table-bloat performance warning that would need addressing before M9 starts
  querying through the frozen API at real traffic volumes;
- record the advisor findings (or "clean") in `PROJECT_STATE.md` once reviewed.

## 3. Deploy `proofrail-app` and `proofrail-worker`, confirm both health endpoints

Railway project `proofrail-0g`, exactly two services (do not add a third):

```text
proofrail-app     start: pnpm --filter @aegisone/web start       health: /health
proofrail-worker  start: node --experimental-strip-types apps/worker/src/server.ts   health: /health
```

After this branch (and every subsequent M8.5–M8.10 branch still pending merge) is merged to `main`
and Railway redeploys both services from `main`, confirm:

```bash
curl -sS https://proofrail-app-production.up.railway.app/health
curl -sS https://<proofrail-worker-production-host>/health
```

Both must return `200` with the expected JSON status shape (`apps/web/src/product.ts`'s
`{ ok: true, service: "aegisone", mode: "product" }` for the app;
`apps/worker/src/status.ts`'s status object, `signerConfigured: true`, for the worker). If either
returns non-200 or the worker reports `signerConfigured: false`, treat M9 as **not** frontend-ready
regardless of what this issue's code/contract gate says.

## 4. Confirm production topology is still exactly two services

In the Railway dashboard for project `proofrail-0g`, confirm the service list is exactly
`proofrail-app` and `proofrail-worker` — no third service was added by this or any pending branch.
(Static confirmation from this environment: no branch merged as part of M8.1–M8.11 adds a
`railway.json`/`railway.toml`/Procfile for a third service, a new Dockerfile, or a new deployable
entry point outside `apps/web`/`apps/worker`. This is a code-level guarantee, not a live one — the
dashboard check above is still required to catch anything configured outside the repo.)

## 5. Update Railway watch/build paths for the new M8 workspace packages

If `proofrail-app`'s Railway build is configured with explicit watch paths (rather than watching
the whole repo), confirm the following newer packages are included so a change to any of them
triggers a redeploy:

```text
packages/discovery-ard
packages/discovery-providers
packages/catalog-store
packages/source-auth-github
packages/skill-verification-link
apps/web
```

If the Railway build already watches the whole monorepo (no path filter configured), this item is
already satisfied — confirm which mode is configured in the dashboard.

## 6. Configure the GitHub App for live `REPOSITORY_AUTHENTICATED` claims

M8.5's OAuth flow is fully implemented and tested against mocked GitHub responses, but no real
GitHub App exists in any environment yet. To prove a real `REPOSITORY_AUTHENTICATED` claim:

1. Create/install a GitHub App named (or similar to) `AegisOne Source Verifier` per
   `docs/14-source-authentication.md`'s "M8 GitHub App design" section.
2. Add these variables to `proofrail-app` on Railway (never `proofrail-worker` — the app service is
   the only place GitHub OAuth secrets belong):

```text
GITHUB_APP_CLIENT_ID
GITHUB_APP_CLIENT_SECRET
GITHUB_APP_SLUG
GITHUB_OAUTH_CALLBACK_URL
GITHUB_OAUTH_STATE_SECRET
```

3. Complete one interactive browser authorization against a real public repository the owner
   controls (`GET https://proofrail-app-production.up.railway.app/auth/github/start?returnTo=/`),
   confirm the resulting claim reaches `REPOSITORY_AUTHENTICATED` via
   `GET /api/v1/source-claims/:claimId`, and record the claim id / repository / digest in
   `PROJECT_STATE.md` as live evidence (the same pattern `hackathon/m7-live-evidence.json` uses for
   M7).

## 7. Confirm a real external MCP client renders the three tools correctly

Point a real MCP-aware client (Claude Desktop, Claude Code's own `/mcp` configuration, Cursor, or
similar) at:

```json
{
  "mcpServers": {
    "aegisone": {
      "url": "https://proofrail-app-production.up.railway.app/mcp",
      "transport": "streamable-http"
    }
  }
}
```

Confirm the client lists exactly `aegisone_search`, `aegisone_inspect`, `aegisone_evaluate` and
that at least one real call through each tool round-trips correctly in that product's own UI. This
is the one item in `docs/21-m8-mcp-interface.md`'s "what is proven vs. what still needs a human"
section that remains outstanding.

## 8. Produce the live M8.9 substitution-proof evidence ledger entry

Follow `docs/22-m8-9-live-run-runbook.md` end to end. This requires items 6 above (GitHub App
credentials) plus a separate, explicit approval for real 0G Galileo testnet spend (per `AGENTS.md`'s
cost discipline — do not run this merely to close this checklist item; it needs its own approval
gate). Record the resulting `hackathon/m8-9-live-evidence.json` and update `PROJECT_STATE.md`'s
M8.9 section from "local/deterministic proof implemented" to "live-proven" only once this actually
runs successfully.

## Summary table

| # | Item | Owner action required | Blocks M9 code start? |
| --- | --- | --- | --- |
| 1 | Apply 4 pending Supabase migrations | Supabase project credentials | No — M9 can build against the frozen contract now; but it cannot read real persisted data until this runs |
| 2 | Review Supabase advisors | Supabase dashboard access | No |
| 3 | Confirm both Railway health endpoints | Railway dashboard/CLI access | No |
| 4 | Confirm exactly 2 Railway services | Railway dashboard access | No |
| 5 | Confirm/update Railway watch paths | Railway dashboard access | No |
| 6 | Create GitHub App + live `REPOSITORY_AUTHENTICATED` proof | GitHub App creation + Railway env vars | No |
| 7 | Real MCP client smoke test | Any MCP-aware client + running deployment | No |
| 8 | Live M8.9 evidence ledger entry | GitHub App + explicit 0G testnet spend approval | No |

None of these items block M9 frontend **code** from starting against the frozen contract
(`docs/24-m8-11-contract-freeze.md`) — the backend JSON/MCP shapes do not change based on whether
production is deployed or Supabase is migrated. They do block calling **production** "verified
healthy" or M8's live-evidence acceptance criteria "fully met." See the PR description for the
explicit distinction between "backend contract is frontend-ready" (true, as of this issue) and
"production is verified healthy" (not yet true, pending the items above).
