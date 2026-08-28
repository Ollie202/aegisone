# ADR-018 — Audit Lab, plain-English reports, and deferring a public Package/Artifact Verification trigger

> **Renumbered from ADR-017 during PR 4/4's final reconciliation.** This document and
> `docs/decisions/017-0g-evidence-publication-and-verified-library.md` were both accidentally
> numbered 017 by the PR 2 and PR 3 agents. This file is the one that moved; its content and PR 2
> decisions are unchanged.

## Status

Accepted. Implemented by PR 2 of the four-PR product restructure (`docs/decisions/016-four-section-product-ia-and-skill-library.md`).

## Context

PR 1 established the four-section IA and set `/audit` (alias `/scan`) as the AUDIT section home,
serving the existing paste-to-scan tool unchanged. That tool screens pasted Agent Skill content
with the deterministic `@aegisone/skill-audit` rules — genuinely useful, but it is one audit type
presented as if it were the whole section.

AegisOne's issue for this PR asked for an honest "Audit Lab": one obvious place that presents every
audit type AegisOne could plausibly offer, live or not, with no dead buttons and no fake results.
It also asked for a plain-English report a non-security-engineer can follow, and for an evaluation
of whether the fully-built but unexposed M8.6 Package/Artifact Verification engine
(`packages/skill-verification-link`) could be safely reached from a public route in this PR.

## Decision

### 1. Audit Lab presents four audit types, three of them explicitly upcoming

`/audit` (and `/scan`) now opens with a four-card selector before the existing scan tool:

| Audit type | Status | What it does |
| --- | --- | --- |
| Agent Skill Audit | **LIVE** | The existing deterministic paste-to-scan tool, unchanged in its core behaviour. |
| Package / Artifact Verification | Upcoming (deferred, see below) | Real MATCH/MISMATCH correspondence evidence. The engine exists; the public trigger does not yet. |
| Smart Contract Audit | Upcoming (not implemented) | No Solidity/EVM analyzer exists in this codebase. |
| MCP / Agent Capability Audit | Upcoming (not implemented) | No distinct audit of an MCP server's/agent's tool surface exists; MCP servers are only discoverable, not audited. |

Each upcoming card states plainly why it is not live rather than looking broken or clickable into
nothing — no card links to a route that 404s or silently no-ops. This mirrors PR 1's
`/verified`/`/agents` "not built yet" sections rather than introducing a new pattern.

### 2. The plain-English report was extended, not replaced

`apps/web/src/ui/scan-view.mjs` and `apps/web/src/scan-service.ts` already rendered the verdict,
findings, and a non-authoritative advisory pass correctly separated from the deterministic
verdict (PR M8.7/paste-to-scan work). This PR adds, without touching any existing trust semantic:

- an **"What AegisOne inspected"** panel showing the exact file list and byte counts read
  (`InspectedSummary`, a new additive field on `ScanApiResponse` — every existing field is
  unchanged, so this is not a breaking contract change);
- a **plain-English "why this matters"** paragraph per finding, keyed by the real `ruleId` the
  backend returns (`apps/web/src/ui/rule-explanations.mjs`) — presentation-only content that never
  changes severity, verdict, or which findings are shown;
- an unconditional, always-rendered **"What AegisOne did NOT prove"** section on every scan result
  (CLEAN included), addressing Threat M8-019 directly: no publisher identity was verified, no
  distributed artifact was compared, absence of findings is not proof of safety, and an advisory
  opinion (if requested) can never change the verdict.

### 3. Package/Artifact Verification is deferred, not exposed, in this PR

This was the explicit judgment call the issue asked for. After reading
`packages/skill-verification-link/src/authorization.ts` and `enrichment.ts`:

- the engine already has a brand-gated `VerificationAuthorization` (constructible only via
  `authorizeVerificationTrigger`, which checks a pre-shared token digest) and a
  `VerificationConcurrencyLimiter` — exactly the primitives a future trigger route must reuse;
- but *nothing in this repository today* configures or provisions that shared token for an
  end-user-facing flow. The only realistic safe design is "the server holds the admin token
  internally and authorizes on a caller's behalf once they select an existing catalog resource/
  version", which requires: a new catalog-selection UI, a new strict independent rate limiter (far
  stricter than Tier-1 scan, per `docs/17-m8-security-boundaries.md` Threat M8-005), and — because
  the underlying operation is a real bounded `git clone` plus a distribution-artifact fetch, not a
  cheap read — a real end-to-end test against a live catalog resource with a real source claim,
  which this environment cannot safely exercise inside this PR's scope without risking exactly the
  "verification spend abuse" this repository has guarded against since M8.5.

Rather than wire a rushed trigger route around a security-critical gate and call it done, this PR
leaves `packages/skill-verification-link` exactly as M8.6 left it — fully built, fully tested,
reachable only by an already-authorized worker/admin caller — and marks Package/Artifact
Verification **upcoming** in the Audit Lab UI, with the reasoning above stated in the card itself.
This is the explicit "honest deferral is strictly better than an unsafe endpoint" option the issue
authorized.

Existing verification evidence remains fully visible where it already was: any catalog resource
that already carries a `capability_verifications` row (for example, via `/api/v1/resources/:id/evidence`
or the Evidence Passport) still renders it. What is deferred is *anonymously triggering a new one*,
not *reading an existing one*.

### 4. The library grew with two real, well-formed Agent Skill fixtures

`examples/agent-skills/clean-review/` (a genuine CLEAN example) and
`examples/agent-skills/malicious-sync/` (a genuine, clearly-labelled CRITICAL detection example)
are now seeded into the library via `apps/web/src/library-seed-fixtures.ts`, using the same
unmodified production packaging/audit/validation functions PR 1's cookbook seed used. Both are
labelled `aegisone-repository-fixture` in discovery metadata — never presented as a third-party
discovery — and both carry `sourceAssurance: NONE` / `sourceInspection: NOT_RUN` /
`correspondence: NOT_EVALUATED`, because neither is a claimed external repository/commit; only
`security` carries real evidence, from a real audit run over their real bytes.

## Consequences

**Good.** Every audit type AegisOne could plausibly offer is now visible in one place, honestly
labelled. The report explains findings in language a non-specialist can follow without diluting
any existing trust distinction. The library gains two credible, well-formed anchors — one clean,
one a genuine positive-detection example — instead of relying solely on PR 1's single
format-validation-failing cookbook entry.

**Costs and limits, stated plainly.**

- Package/Artifact Verification remains publicly untriggerable after this PR. A future PR must
  design the catalog-only selection UI, the independent rate limiter, and a real (not merely
  fixture-local) end-to-end proof before exposing it.
- Smart Contract Audit and MCP/Agent Capability Audit remain entirely unimplemented; nothing in
  this PR moves them closer to existing beyond stating their absence honestly.
- The plain-English rule-explanation map (`rule-explanations.mjs`) is maintained by hand and can
  fall behind if `packages/skill-audit/src/audit.ts` gains a new rule; a finding for an
  unrecognised rule id still renders correctly (backend `title`/`severity` verbatim) but without
  the extra paragraph, which is the safe failure mode.

## Alternatives considered

**Wire Package/Artifact Verification behind a simple "admin token in an environment variable,
exposed to any caller who provides it" route.** Rejected: that is not meaningfully different from
no gate at all once the token leaks once, and the issue's hard constraint requires reuse of the
existing authorization primitive plus a strict independent rate limit and catalog-only scoping —
none of which a same-PR rush job could responsibly claim to have tested against real spend risk.

**Build a shallow Solidity pattern-matcher for Smart Contract Audit so the card would not say
"upcoming."** Rejected outright per the issue: a half-working contract auditor that misses real
vulnerabilities is a worse outcome than an honest "not yet," and would misrepresent AegisOne's
actual capability.
