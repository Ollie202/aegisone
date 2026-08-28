# ADR-019 — FOR AGENTS as a real machine-onboarding surface, and PR 4/4 final reconciliation

## Status

Accepted. Implemented by PR 4 of the four-PR restructure started in ADR-016.

## Context

ADR-016 (PR 1) shipped `/agents` as a page built "from what genuinely works today," with a visible
"not built yet" section for the parts PR 4 would add. That placeholder correctly advertised the
live `/mcp` endpoint and the frozen M8.7 REST contract in prose, but it did not give an agent
operator anything to copy-paste, did not prove its claims against the running server, and — because
it was hand-written prose rather than a data-driven page — had no mechanism stopping it from
drifting out of sync with `apps/web/src/mcp.ts` the next time a tool was added, renamed, or removed.

Two more things needed resolving before this restructure could be called finished:

1. **The project's own truth-tracking documents had drifted.** `PROJECT_STATE.md` and
   `planning/current-sprint.md` still described PR 2 as "open, not merged" and PR 1 as the only
   completed step, when PR 1, 2, and 3 had each already been merged (as their own GitHub PRs) into
   the next feature branch in the chain — `feature/skills-library-ia` → `feature/audit-lab` →
   `feature/0g-publish-verified-library` → `feature/for-agents`. None of that work had reached
   `main` yet, because each PR's *target* was the next branch in the chain, not `main` directly.
2. **Two unrelated architecture decisions had both claimed ADR number 017.** The PR 2 agent wrote
   `docs/decisions/017-audit-lab-and-package-verification-deferral.md`; the PR 3 agent, working from
   a stale view of the decisions directory, independently wrote
   `docs/decisions/017-0g-evidence-publication-and-verified-library.md`. Both were merged. Left
   alone, "ADR-017" would mean two different things depending on which file a reader opened.

## Decision

### 1. `/agents` is now built from data the server actually returns, not prose describing it

`apps/web/src/pages/agents.ts` exports `ADVERTISED_MCP_TOOLS` — the literal list
`["aegisone_search", "aegisone_inspect", "aegisone_evaluate", "aegisone_scan"]` — and every
request/response block on the page is a verbatim capture from a real server run, not a
hand-authored example. Two things make this hard to let drift silently:

- `apps/web/test/agents-page.test.ts` connects a real `@modelcontextprotocol/sdk` `Client` over a
  real `POST /mcp` to a real `node:http` server and asserts the connected tool-name set is exactly
  equal to `ADVERTISED_MCP_TOOLS` — not a subset, not a superset. Every endpoint the page prints is
  also issued as a real HTTP request in the same test and must not 404.
- The connection instructions in the "Connect it" section address `resolveConnectOrigin(host,
  forwardedProto, fallbackBaseUrl)` — the origin that served the current request — rather than a
  hardcoded production URL. A caller-controlled `Host` header is accepted only when it is
  structurally a valid `host[:port]`, so a local, preview, Railway, or Vercel deployment each render
  correct copy-paste instructions for themselves, and a malformed or hostile `Host` header can never
  place attacker-chosen text inside a block a reader is invited to paste and run.

### 2. What the page cannot do is stated as plainly as what it can

`NOT_AVAILABLE_TODAY` is its own rendered section, not a footnote: retrieving a stored evidence
bundle from 0G (no funded publication has run under ADR-017, so `trust.canonicalEvidence.storageRoot`
is `null` for every resource this deployment serves, and AegisOne proxies no retrieval even when a
root does exist); calling the operator-only `POST /api/v1/publish` (not part of the agent surface,
and not going to become one — AGENTS.md forbids a public endpoint that can spend 0G); a
`SIGNED_RELEASE` source-assurance level (no code path emits it); and per-agent credentials or
rate-limit budgets (there are none — every read/policy route is public and unauthenticated).

### 3. Threat M8-018's denylist is printed, not just enforced

The page lists `aegisone_install`, `aegisone_execute`, `aegisone_sign`,
`aegisone_run_arbitrary_build`, and `aegisone_upload_secret` as tools that have no code path
anywhere in this repository. `apps/web/test/m9-frontend-security-audit.test.ts` asserts the
advertised tool set can never contain one of these names, and separately asserts every advertised
name fails a regex for mutation/build/sign/upload/publish/write/deploy/spend verbs — so a future tool
addition that violates the read/policy-only boundary fails a test before it could ever be advertised.

### 4. `PROJECT_STATE.md` and `planning/current-sprint.md` are corrected to the real merge topology

PR 1 (`#51`), PR 2 (`#52`), and PR 3 (`#53`) are each marked merged, into the next branch in the
chain rather than into `main`. PR 4 (`feature/for-agents`) is marked open against `main`. Merging
PR 4 is therefore the single action that brings all four PRs into `main` together — that is called
out explicitly so a reviewer does not mistake "PR 4 merged" for "only the FOR AGENTS page landed."

### 5. The ADR-017 collision is fixed by renumbering, not by picking a winner

`docs/decisions/017-audit-lab-and-package-verification-deferral.md` is renamed to
`018-audit-lab-and-package-verification-deferral.md`, its own heading corrected, and a note added
pointing at this ADR for the reason. `docs/decisions/017-0g-evidence-publication-and-verified-library.md`
keeps its number, since it already had by far the larger number of committed cross-references
(`apps/web/src/pages/agents.ts`, three test files, `docs/06-integrations.md`,
`docs/15-m8-api-inventory.md`, and `PROJECT_STATE.md`) and renumbering it would have touched more
files for no benefit. Every prose/comment reference to the audit-lab decision (`apps/web/src/pages/scan.ts`,
`PROJECT_STATE.md`, `planning/current-sprint.md`) now says ADR-018. This document is ADR-019 — the
next free number after the fix, not 018, since 018 was claimed by the renumbered file.

### 6. `docs/18-m9-frontend-plan.md` is marked superseded rather than silently ignored

The document still describes the original four-page IA (`Search`, resource detail, `Claim`,
`Ledger`) that ADR-016 explicitly replaced. Rather than delete a document with real historical
content (the Evidence Passport section list it specifies is still accurate and still cited by
`docs/24-m8-11-contract-freeze.md`), it now carries a banner at the top pointing a reader to
ADR-016 through ADR-019 for the current information architecture, so nobody implements against the
stale four-page plan by mistake.

## Consequences

- A future MCP tool addition, rename, or removal fails `agents-page.test.ts` until `/agents` is
  corrected — the page cannot silently drift from the server it describes.
- `ADR-017` now refers unambiguously to the 0G evidence-publication decision everywhere in the repo.
- Merging PR 4 is the action that finally brings the whole four-section-IA restructure into `main`;
  `PROJECT_STATE.md`'s "Current next action" says this explicitly so it is not missed.
- No trust semantic, verdict, rate limit, or advisory-override behavior changed. This ADR is
  documentation/onboarding-surface work only.
