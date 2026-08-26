# ADR-013 — M9 Hub frontend: evolve the current server-rendered app, light/modern visual direction

## Status

Accepted for M9 (Issue #31).

## Context

`docs/18-m9-frontend-plan.md` asks M9 to evaluate two options at kickoff:

- **Option A** — evolve the current lightweight Node-rendered `apps/web` app.
- **Option B** — introduce a modern frontend framework inside the same `proofrail-app` service.

At M9 kickoff, `apps/web` is a single Node process (`node --experimental-strip-types src/server.ts`,
no bundler, no build step) with ~1,875 lines across `product.ts`, `api-v1.ts`, `source-auth.ts`,
`mcp.ts`, `search-service.ts`, and two existing hand-written HTML string renderers
(`render.ts`/`render-skill.ts`). The M9 surface area is four pages: capability search, a
multi-section Evidence Passport, a multi-step GitHub OAuth source-claim flow, and a policy
playground with live re-evaluation.

The plan doc also frames the dark "proof-first" visual language used by the existing M1–M7 landing
page as the default to evolve. The repo owner (the human, not the issue text) explicitly requested a
different visual direction for M9: a modern, light/white infrastructure-tooling look (Vercel/
Linear/Stripe-docs register) rather than a dark neon Web3 look. This ADR also records that deviation,
since `docs/18` names the dark language as the default.

## Decision

### Technology: Option A — evolve the current server-rendered app

Do not introduce React/Vue/a JSX build step/a bundler. Instead:

- Add four new server-side HTML page renderers (`apps/web/src/pages/*.ts`), following the exact
  existing pattern (`render.ts`, `render-skill.ts`, `product.ts`'s `renderProductHomeHtml`) of pure
  functions that take already-fetched backend data and return an HTML string — directly unit
  testable with `node:test`, no DOM/JSDOM/browser test harness required.
- Add a small set of **isomorphic** plain-JavaScript ES modules (`apps/web/src/ui/*.mjs` — no
  TypeScript syntax, so they run unmodified both in Node via a relative import and in the browser
  via `<script type="module">`) for the few pieces of markup that must render identically whether
  produced by the server (initial/no-JS load) or the browser (live re-render after a fetch): search
  result cards, the policy-evaluation result block, and the evidence-dimension badge row. This
  eliminates duplicate rendering logic between SSR and client-side re-render without a bundler.
- Add one small vanilla-JS progressive-enhancement script (`apps/web/public/app.js`, no framework,
  no transpilation) per interactive page: search-box debounce + `fetch('/search', ...)`, the policy
  playground's live re-evaluate-on-change, and the GitHub source-claim multi-step flow
  (`fetch` calls to the real M8.5 routes). Every page still renders a materially useful server-side
  view with JavaScript disabled (search results, the full Evidence Passport, static claim
  instructions); only the OAuth-driven interactive parts of `/source/claim` and playground
  live-re-evaluation require JS, which is inherent to those flows (an OAuth popup/redirect and a
  live-updating form cannot be meaningfully server-rendered without JS regardless of framework
  choice).
- `apps/web/package.json` gains no new runtime dependency and no build step. Production continues to
  run exactly as it does today (`node --experimental-strip-types src/server.ts`); static assets
  (`public/*.js`, `public/*.mjs`, `public/*.css`) are served directly from disk by a new small
  static-file route, with a fixed allowlist of filenames (no path traversal, no directory listing).

### Why not Option B

A real framework (React/Preact/etc.) was seriously considered given the genuine interaction surface
(search-as-you-type, a multi-section passport, an OAuth-driven multi-step form, live policy
re-evaluation). It was rejected for M9 specifically because:

- the four pages do not have a deep client-side state graph or nested-component tree — each page is
  one root view with a handful of independently updatable regions (result list, playground result
  block, claim-flow step), which the isomorphic-`.mjs`-module + vanilla-DOM approach above handles
  without a virtual DOM;
- introducing a bundler changes the production execution model (from "run TypeScript directly via
  Node's type-stripping" to "build a client bundle, deploy the artifact, keep it in sync with a
  process that still runs source TypeScript directly on the server") — real risk for a solo builder
  under a hackathon deadline, for a benefit (component ergonomics) the actual page count doesn't need
  yet;
- it would add a new class of "did the deployed bundle match the reviewed source" question on top of
  every other M8 integrity concern this repository already takes seriously.

If a future milestone needs more than these four pages (nested client routing, shared client-side
state across many views, a component library), that is the trigger to revisit Option B — not
speculative adoption now. This is the same "smallest coherent option" instruction `docs/18` gives.

### Visual direction: light/modern, per explicit repo-owner instruction

`docs/18-m9-frontend-plan.md`'s "Visual direction" section names evolving the existing dark
"proof-first" language as the default. The repo owner explicitly instructed a different direction for
M9: a white/near-white background, dark text, restrained single accent color, generous whitespace,
clean sans-serif typography, and subtle borders/shadows instead of dark chrome — an
infrastructure-tooling register (Vercel/Linear/Stripe docs), not the existing neon-on-dark M1–M7
landing page and not a generic Web3 look. This ADR records that as a deliberate, owner-approved
deviation from `docs/18`'s stated default, not an oversight. Every other rule in that section still
applies: infrastructure-grade, evidence-forward, strong text/icon state labels (never color alone for
MATCH/MISMATCH/DENY), not an App Store clone.

The pre-existing M1–M7 dark "proof-first" landing page (`renderProductHomeHtml` in `product.ts`) is
preserved unchanged and moved to `/proof` rather than deleted — it remains real, already-proven
evidence (M5 Aristotle mainnet anchor, M7 live Agent Skill run) and this issue does not touch it. `/`
now serves the new light-themed Hub/Search page, per the M9 acceptance criteria.

## Trust consequences

- No ALLOW/REVIEW/DENY or MATCH/MISMATCH/DIVERGED value is computed, cached, or reinterpreted in
  client-side JavaScript anywhere in this change; every such value is rendered verbatim from the
  corresponding backend JSON field, both in the SSR path and in the `fetch`-driven re-render path
  (same isomorphic `.mjs` renderer either way).
- The browser only ever calls `proofrail-app`'s own JSON endpoints (`POST /search`,
  `GET /api/v1/resources/:id`, `GET /api/v1/resources/:id/evidence`, `POST /api/v1/policy/evaluate`,
  `GET /api/v1/source-auth/github/repositories`, `POST /api/v1/source-claims`,
  `GET /api/v1/source-claims/:id`, plus the existing `GET /auth/github/start` browser redirect) —
  never Supabase directly, never a third-party discovery provider directly.

## Alternatives considered

### Preact + htm (no JSX build step)

Considered as a middle ground (small runtime, template literals instead of JSX, so `esbuild` could
bundle it without a JSX loader). Rejected for the same reason as full React: it still adds a build
step and a new dependency for four pages that do not need component reuse depth beyond what plain
functions already provide in this codebase's existing render-function pattern.

### Keep the dark theme and skip the ADR

Rejected: `docs/18` states a default, the repo owner overrode it, and `AGENTS.md`/`CODEX.md` require
an ADR before a stack/visual deviation of this kind so the decision is traceable rather than silently
diverging from the plan doc.

## Consequences

Positive:

- zero new production dependency, zero new build step, zero new deployment risk;
- SSR-first pages remain functional without JavaScript except where the flow is inherently
  interactive (OAuth, live policy re-evaluation);
- one rendering module per shared UI concept (search card, policy result, evidence badges),
  eliminating server/client duplication without a framework;
- directly unit-testable with the existing `node:test` harness, no new test tooling.

Trade-offs:

- no component-level reactivity/state management library if a future page needs it — deferred to a
  future ADR if and when the page count/interaction depth actually requires it;
- the vanilla-JS client script is hand-written DOM code rather than declarative components, which is
  more verbose per page than JSX/Preact would be — accepted given the page count.
