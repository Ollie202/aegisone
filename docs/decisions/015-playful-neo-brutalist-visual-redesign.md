# ADR-015 — Playful Neo-Brutalist visual language for the AegisOne Hub

## Status

Accepted. **Supersedes the "Visual direction" section of ADR-013 only.**

ADR-013's **technology** decision is unchanged and remains in force: Option A (evolve the existing
server-rendered `apps/web`), vanilla JavaScript, no framework, no bundler, no build step, isomorphic
`apps/web/src/ui/*.mjs` render modules shared byte-for-byte between SSR and the browser, production
still running exactly `node --experimental-strip-types src/server.ts` on one `aegisone-app` service.
Nothing in this ADR adds a dependency, a build step, a service, or a network asset request.

## Context

ADR-013 recorded a light/modern "infrastructure tooling" visual direction (Vercel/Linear/Stripe-docs
register) for the M9 Hub, itself a deliberate repo-owner override of `docs/18-m9-frontend-plan.md`'s
dark proof-first default.

The repo owner has now explicitly instructed a different visual direction, by name: their own
reusable design skill, `goat_cookbook/frontend_design/playful_neo_brutalist_web.md`, which they use
across their other work. That document specifies a bold editorial style blending neo-brutalism,
Memphis-style graphics, retro-futurist tech illustration, editorial layout, vector-comic
illustration, and controlled anti-grid composition — explicitly rejecting the "generic SaaS
template" register ADR-013's direction sits in.

The trigger is a hackathon-demo-facing frontend: AegisOne's product personality is "proof
infrastructure with teeth", and the previous restrained light theme read as a compliance dashboard
rather than as the opinionated verification tool it is. This is a visual/UX change only. The
information architecture in `docs/18-m9-frontend-plan.md` (which pages exist, what each one shows,
which backend field each rendered claim traces to) is unchanged, and every trust semantic in
`AGENTS.md` is unchanged.

Two other repo-owner-driven changes ship in the same pass:

- a new `/scan` page exposing the just-merged paste-to-scan backend (`POST /api/v1/scan`, the
  `aegisone_scan` MCP tool, `apps/web/src/scan-service.ts`), which previously had no human surface;
- the four-page nav becomes five (`Search`, `Scan`, `Claim`, `Ledger`).

## Decision

### Visual language

Adopt the repo owner's Playful Neo-Brutalist skill as the Hub's visual system: heavy 2–3px ink
linework on every container/chip/button, large flat colour fields instead of gradients, oversized
editorial typography (`clamp()`-scaled, 700–900 weight, tight negative tracking), hard offset
shadows used sparingly instead of soft elevation, a slim numbered vertical navigation rail on
desktop that recomposes to a compact pill bar on mobile, decorative objects that deliberately break
the frame boundary, and one large outlined rounded frame per page instead of a field of isolated
cards.

Structural rules taken verbatim from the skill and enforced in `apps/web/src/pages/layout.ts`:
real 12-column-style CSS Grid underneath the visual disruption; `clamp()` typography; a single set
of CSS custom properties as the palette; reusable primitives (`.frame`, `.panel`, `.pill`,
`.button`, `.badge`, `.edgeLabel`, `.sticker`); ambient motion limited to 2–9px drifts and
150–500ms interaction states, all disabled under `prefers-reduced-motion`.

### Visual metaphor: the stamp (one family, reused everywhere)

Per the skill's Design Restraint Rules, the product uses exactly **one** illustration family:

- an **outlined stamp ring** — the seal AegisOne presses *only* when real evidence exists;
- a **byte grid** — the bytes AegisOne actually compares;
- a **comparison arrow** connecting two byte grids.

Both are defined once as inline SVG `<symbol>`s (`#ic-stamp`, `#ic-bytegrid`, `#ic-arrow`) in the
layout shell and `<use>`d everywhere: the brand mark, the hero (a distributed byte grid vs. an
independently reproduced one, stamped above), the per-result card marks, the Evidence Passport
header stamp, and the `/scan` verdict stamp. All illustration is same-origin inline SVG — there is
no raster asset, no image host, and no external request other than the Google Fonts stylesheet for
the display face (which has a full system fallback stack).

Every stamp in the product is `aria-hidden` decoration that *reinforces* an adjacent textual state.
A resource with no evidence gets an empty dashed outline, never a stamp.

### Palette and trust-state colour mapping

Base palette is the skill's default, as CSS custom properties:

```
--ink #0A0A0A   --paper #F7F5EF   --card #FFFDF7   --periwinkle #D8E1FF
--yellow #FFD91A   --lavender #B79CFF   --cyan #22DCEB
```

plus two states the skill's default palette does not cover but AegisOne's domain requires:
`--amber #F5A524` (caution, deliberately distinct from brand yellow) and `--alarm #FF4A3D`
(negative).

Trust-state mapping — deliberate, documented, and applied only inside badges/stamps:

| tone | token | states |
| --- | --- | --- |
| affirmative / proven | cyan `#22DCEB` | `MATCH`, `REPOSITORY_AUTHENTICATED`, `SIGNED_RELEASE`, `ALLOW`, `CLEAN` |
| discovery-only / informational | lavender `#B79CFF` | `INDEXED`, canonical evidence `AVAILABLE` |
| caution | amber `#F5A524` | `DECLARED`, `DIVERGED`, `STALE`, `INSUFFICIENT_EVIDENCE`, `REVIEW`, `FLAGGED`, provider unavailable |
| negative | alarm `#FF4A3D` | `MISMATCH`, `DENY`, `BLACKLISTED`, integrity-check failure |
| neutral / absent | paper-neutral `#E6E2D6` | `NONE`, `NOT_EVALUATED`, `AUDIT NOT RUN` |

Two consequences of this mapping are load-bearing:

1. **Brand yellow `#FFD91A` is reserved for chrome** — the primary CTA, the rail's active marker,
   the numbered step markers — and is *never* a trust state. "The yellow thing" can therefore never
   be misread as a verdict.
2. **`INDEXED` (lavender) and `MATCH` (cyan) are different tokens**, and discovery-only result rows
   additionally get a hatched edge band and an unpressed dashed stamp instead of a pressed one. A
   bolder visual language must not make everything look equally official; this is asserted by a
   regression test in `apps/web/test/m9-frontend-security-audit.test.ts`.

Colour is never the only signal. `apps/web/src/ui/badges.mjs` is unchanged in behaviour: every badge
still renders a glyph **and** a full text label, so every state survives colour-blindness, greyscale
printing, and screen readers. The palette only makes an already-textual state faster to scan.

### Page-level application

- **`/` Hub/Search** — the skill's Hero Formula: three category pills, an oversized multi-line
  headline with one accent-marked word, search as the obvious primary CTA, one dominant illustration
  cluster, and loose decorative bytes escaping the frame. Results render as an **editorial list**
  with a hard rule between rows, not the three-column card grid the skill's anti-patterns reject.
  Every independent dimension still renders as its own outlined chip.
- **`/resources/:id` Evidence Passport** — the highest-density page in the product, and the one this
  language most had to earn. The seven `docs/18` sections become **one continuous outlined run** of
  numbered, alternately-tinted bands inside a single frame ("one graphic composition, not twenty
  cards"), with a header stamp driven only by `trust.correspondence.status`. All seven `<h2>`
  headings and every field are unchanged.
- **`/source/claim`** — form-heavy utility page, kept deliberately restrained per the skill's
  Design Restraint Rules: the outline/typography/colour language carries over (oversized headline,
  rotated numbered step markers, outlined inputs) with no decorative cluster of its own.
- **`/scan` (new)** — built on the same SSR page + isomorphic `.mjs` module pattern as the other
  three (`apps/web/src/pages/scan.ts` + `apps/web/src/ui/scan-view.mjs`, wired through the existing
  `data-page` attribute in `apps/web/public/app.js`). The stamp metaphor becomes the verdict stamp,
  changing per `CLEAN`/`FLAGGED`/`BLACKLISTED` alongside the verdict word rendered at display size.
- **`/proof`** — the pre-existing M1–M7 dark proof-first landing page is explicitly out of scope and
  is untouched, exactly as ADR-013 left it.

## Trust consequences

None. This change is presentational, and the audit surface is deliberately unchanged:

- no ALLOW/REVIEW/DENY, MATCH/MISMATCH/DIVERGED, source-assurance level, or
  CLEAN/FLAGGED/BLACKLISTED verdict is computed, cached, thresholded, or reinterpreted in client
  JavaScript. Every such value is rendered verbatim from the corresponding backend JSON field,
  through the same isomorphic module on both the SSR and `fetch` paths;
- `apps/web/src/ui/escape.mjs` still guards every untrusted string. The new `/scan` surface adds a
  new class of untrusted input — raw pasted content echoed back inside deterministic findings
  (`path`, `evidence`, `title`, `ruleId`) and the advisory `summary` — and every one of those is
  escaped, with an XSS regression test;
- the paste-to-scan page always renders the structural facts that a paste has **no** publisher and
  **no** claimed source revision: source assurance `NONE` and correspondence `NOT_EVALUATED` are
  shown explicitly rather than omitted, so a `CLEAN` screening can never be mistaken for AegisOne
  source or byte evidence;
- the Tier-2 LLM advisory pass renders in a visually and textually distinct dashed container,
  always stamped "advisory only — not authoritative", and never inside the verdict panel — matching
  the backend contract that the advisory field never sets or overrides `verdict`;
- no generic `SAFE`/`TRUSTED` badge and no invented numeric trust score exists in any form,
  including at display type size. The existing "no `>SAFE<` in any render module or page",
  "no unescaped XSS", "policy renders verbatim", and "no bare `verified:true`" regression tests pass
  unweakened;
- no secret-bearing value, and no import of `storage-0g`/`sandbox-0g`/`registry-0g`/
  `source-auth-github`, exists in any browser-reachable file.

## Alternatives considered

**Keep ADR-013's light/minimal theme.** Rejected: the repo owner explicitly requested this specific
named design system, and `AGENTS.md` requires an ADR rather than a silent visual divergence.

**Apply the style only to the new `/scan` page.** Rejected: two visual languages inside one product
is worse than either language alone, and the skill's own Originality/Restraint rules assume a whole
system.

**Adopt the aesthetic wholesale, including a big stamped verdict word for every state.** Partially
rejected. A giant stamped word is the right hero treatment for the paste-to-scan `verdict`, which is
a real backend field with three defined values — but the same treatment applied to an *aggregate*
would produce exactly the generic SAFE badge `AGENTS.md` forbids, only louder. So the bold-type
treatment is confined to single named backend fields, and the multi-dimensional views keep the
independent-chip grammar `docs/18` specifies.

## Consequences

Positive:

- one coherent, distinctive visual system across all four Hub pages plus the new fifth;
- the product's core claim (independent reproduction, byte comparison, a stamp pressed only on real
  evidence) is now legible as a *picture*, which matters for a 90–120 second judge demo;
- still zero runtime dependencies, zero build step, zero new service; all illustration is
  same-origin inline SVG;
- the discovery-vs-proven distinction is now reinforced by three independent channels (text label,
  glyph, and colour/stamp state) instead of two.

Trade-offs:

- the stylesheet in `layout.ts` is materially larger than ADR-013's, and is a single hand-maintained
  string with no CSS tooling — accepted, consistent with the no-build-step decision;
- the display face is loaded from Google Fonts, which is one external stylesheet request the
  previous theme did not make. It is behind a full system-sans fallback stack, so a blocked/failed
  font request degrades to a correctly laid out page rather than a broken one;
- tests that asserted specific ADR-013 colour tokens were updated to assert the ADR-015 tokens.
  Every test encoding a *product* rule was left unweakened; only visual-detail assertions moved.
