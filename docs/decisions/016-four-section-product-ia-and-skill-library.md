# ADR-016 — Four-section product IA, a real skill library, and deterministic categories

## Status

Accepted. Implemented by PR 1 of a four-PR restructure.

**Supersedes the *information architecture* of ADR-013 / `docs/18-m9-frontend-plan.md` only.**
Nothing else changes:

- ADR-013's **technology** decision stands: vanilla JavaScript, no framework, no bundler, no build
  step, isomorphic `apps/web/src/ui/*.mjs` render modules shared byte-for-byte between SSR and the
  browser.
- ADR-015's **visual language** (Playful Neo-Brutalist) stands and is extended, not replaced.
- Every trust semantic in `AGENTS.md` is unchanged. No trust rule is relaxed anywhere in this ADR.
- Production topology is unchanged: Vercel (primary frontend) plus the two Railway services.

## Context

The M9 Hub shipped as four peer pages — `Search`, `Scan`, `Claim`, `Ledger` — that mirrored the
*backend milestones* rather than anything a visitor wants. Two concrete problems followed.

**The product read as a search box, not a product.** A first-time visitor landed on an empty search
field and had to already know what to type. Nothing communicated what AegisOne is for.

**The only browsable content was protocol fixtures.** `packages/discovery-ard/src/local-catalog.ts`
contains four pinned entries — "Pull Request Reviewer Skill", "Weather Observer MCP Server",
"Travel Planning A2A Agent", "Invoice Extraction API". They exist so `POST /search` and
`GET /.well-known/ai-catalog.json` are ARD-protocol-conformant, and they are the *only* thing the
Hub could show. The repo owner's assessment was that the product looked "full of demo data".

`Claim` compounded it: authenticating a source claim is a publisher-side task, and putting it in
primary navigation asked every visitor to do something almost none of them came to do.

## Decision

### 1. Primary navigation is exactly four sections

| Section | Route | What it answers |
| --- | --- | --- |
| **SKILLS** | `/` | what you can get |
| **AUDIT** | `/audit` | check something you already have, right now |
| **VERIFIED** | `/verified` | what AegisOne actually proved, and what that means |
| **FOR AGENTS** | `/agents` | machine access to the same evidence |

`Claim` and `Ledger` leave primary navigation and keep footer links. **No route was deleted and no
M8.5 source-authentication code was removed.** `/source/claim`, `/proof` and `/scan` all still serve
exactly what they served before, by direct URL.

`/audit` and `/scan` serve the identical, fully working paste-to-scan page; `/audit` is simply its
navigation home. No section of the new navigation is a stub: `/verified` and `/agents` are built
from what genuinely works today (recorded live 0G anchors; the live MCP endpoint and the frozen
M8.7 REST contract), and each states plainly, in its own visible section, which part is not built
yet rather than mocking it up.

### 2. The human skill library is separate from the ARD protocol fixtures

This is the load-bearing distinction of this ADR.

- The four pinned ARD fixtures **keep backing `POST /search` and `/.well-known/ai-catalog.json`
  unchanged**. They are protocol-conformance data.
- They are **never rendered to a human as library content**. `apps/web/test/hub-pages.test.ts`
  asserts by name that none of the four can appear on `/`, while simultaneously asserting they
  still back `POST /search`.
- The library on `/` reads **real rows from the catalog store**, assembled through the same
  `loadAssembledResource` path that `GET /api/v1/resources/:resourceId` and the Evidence Passport
  use. There is no second evidence assembler and no presentation-only trust field.

The library is deliberately **small and real**. Padding it with hundreds of fabricated entries
would recreate exactly the problem this ADR exists to fix.

Live federated discovery (MCP Official Registry, GitHub Agent Finder, Hugging Face Discover) is
presented in its own visually separate strip, explicitly labelled discovery-only, and loaded
client-side after first paint. Rationale: a page load must not block on three upstream APIs, and
`AGENTS.md` requires discovery to stay cheap and read-only. Those results are genuinely live and
carry no AegisOne evidence, which is what the strip says.

### 3. The seeded resource is real, and its awkward parts are shown

The library's credibility anchor is one real resource: the repo owner's own published design
document from `Ollie202/goat_cookbook`, pinned to the exact immutable commit
`1471116222dfe959f091f3d5818993edd968d57c`.

Its real bytes are committed at `apps/web/fixtures/goat-cookbook/` so every digest is reproducible
offline and in CI, and `.gitattributes` marks that path `-text` so Git cannot rewrite line endings
and silently change a digest between a Windows checkout and Linux CI. Every value is computed at
runtime by the existing unmodified production functions (`canonicalSkillPackageBytes`,
`sha256Bytes`, `auditSkillPackage`, `validateSkillPackage`) — no literal digest is copied in.

Real values, pinned by `apps/web/test/library-seed.test.ts`:

| | |
| --- | --- |
| file SHA-256 | `00bebc7df532b47ba9e70319c4058e7725241ed7749c81b3f88ab93265b7c398` |
| canonical package SHA-256 | `5ae591eac9078b26f243675f721456485f85ecf3737ac36ffa565eca87df685a` |
| deterministic audit | `INFO`, 0 findings |
| Agent Skill format validation | **FAILS** — `missing_skill_md` |

**No wrapping was applied.** The file is a prose design guide, not a `SKILL.md` with frontmatter, so
`validateSkillPackage` genuinely rejects it. It was deliberately *not* renamed to `SKILL.md`, not
given synthesised frontmatter, and not paired with a generated sibling — any of which would have
manufactured a passing validation that is not true. It is packaged verbatim, alone, at its real
repository path, and the failing validation is rendered as its own visible dimension. A test
asserts no `SKILL.md` entry exists, so a future "fix" cannot quietly fabricate a pass.

Its four trust dimensions are deliberately conservative, and each is justified:

- **sourceAssurance = DECLARED.** A mapping was supplied by the operator; nobody proved GitHub
  repository authority through the M8.5 flow. Not `REPOSITORY_AUTHENTICATED`, even though the repo
  owner also owns the cookbook repository — authority that was never proven is not evidence.
- **sourceInspection = INSPECTED**, with a real snapshot digest at the exact commit.
- **correspondence = NOT_EVALUATED**, with null digests. There is no distinct *distributed*
  artifact — only the source file. `AGENTS.md`: "`MATCH` requires a distinct distributed/publisher
  artifact... Do not package the same source twice and call that correspondence proof."
- **security = COMPLETED**, carrying the genuine audit result. Zero findings is not a safety claim.
- **canonicalEvidence = NONE**, no 0G storage root. Nothing was written to 0G for this resource.

### 4. Categories are deterministic, documented, and structurally inert

The backend has no category column, and this ADR does not add one. Categories are introduced
honestly as **view-layer discovery metadata**, in the same invariant class as a search relevance
score.

Nine browsable categories — Frontend / Design, DeFi, Smart Contracts, Research, Automation,
Developer Tools, Data, Agents / MCP, Security — plus an explicit `Uncategorized`.

`apps/web/src/ui/skill-category.mjs` classifies as follows:

1. A **curated override table** (keyed by canonical URL) wins first. This is how deliberately seeded
   resources get an editorially chosen category, labelled `curated`, instead of pretending the
   classifier inferred it.
2. Otherwise each category scores 1 point per distinct keyword matched, on token/phrase boundaries
   (so "data" does not match "validate", and "ui" does not match "guide").
3. Highest score wins; ties break by a fixed `CATEGORY_ORDER`, never by chance.
4. A resource *kind* of `mcp-server`/`a2a-agent` maps to Agents / MCP — definitional, not inferred.
5. Anything still unmatched is `Uncategorized`, rendered as a real visible state. Nothing is ever
   guessed into a bucket.

**The non-escalation guarantee is structural, not just conventional:**

- The classifier module has **zero imports**, so it cannot read or produce a trust value. A test
  asserts the import list stays empty and that its executable code never names the trust/policy
  vocabulary.
- `category` is a **sibling** of `trust` on a library entry, never a field inside it.
- Category is never persisted to a catalog row and never appears in the served resource API — a
  test asserts the string `categor` appears nowhere in either.
- `evaluateTrustPolicy` returns identical decisions and reasons for two resources that classify
  differently, and injecting a `category` field into a resource changes nothing.

### 5. Three distinct visual systems, kept apart

A previous pass reused the verdict stamp as the illustration for every skill. That was wrong twice
over: it made every row look identically "sealed", and it drained the stamp of meaning.

| System | What it is | Where |
| --- | --- | --- |
| **Brand mark** | the owner's real logo file | `/static/brand/logo.jpg` |
| **Verdict stamp** | pressed only where real correspondence evidence exists | `#ic-stamp`, `#ic-bytegrid` |
| **Category art** | one bespoke illustration per category (9 + uncategorized) | `apps/web/src/ui/category-art.mjs` |

Category art contains no checkmark, tick, seal-of-approval or shield-with-tick — a category names a
topic, never a verdict — and a test enforces that, along with every category having its own
distinct illustration.

### 6. Design-language application

The SKILLS page follows the design skill's Hero Formula and Design Restraint Rules specifically:
one dominant headline, one dominant original illustration (skill packages on a shelf, one lifted
out and examined, its five evidence slots mostly *empty* — the honest state of a discovery
catalog), three category pills, a primary and secondary CTA, and decorative objects breaking the
frame edge. The verdict stamp is deliberately absent from that hero.

The library itself is a **numbered editorial list with one featured lead entry**, not an endless
identical card grid (design skill §17 explicitly rejects "endless three-column feature cards", §16
requires one dominant element per viewport). Mobile is recomposed rather than shrunk: the index
numeral and illustration become a compact header strip with the text block full-width beneath.
Motion stays within 150–500ms and is fully disabled under `prefers-reduced-motion`.

## Consequences

**Good.** A visitor immediately sees what the product is for. The library is small, real, and every
entry links to a real Evidence Passport. The seeded resource demonstrates the product's actual
value proposition — including by *failing* format validation in public. Categories make the library
browsable without inventing a trust signal.

**Costs and limits, stated plainly.**

- The library currently holds one seeded resource. That is honest, but it is small, and later PRs
  in this restructure are expected to grow it from real ingestion.
- Live federated results require a client-side fetch, so they are absent with JavaScript disabled.
  The catalog library and every trust dimension remain fully server-rendered and readable without
  JavaScript.
- `/verified` and `/agents` each carry a visible "not built yet" section until PRs 3 and 4 land.
- Categories are keyword-derived and will misclassify some resources. That is acceptable precisely
  because a category can never influence trust or policy — the blast radius of a wrong category is
  a resource appearing under the wrong browse filter, and nothing else.
- No new store method, no new Supabase Edge Function action, no new hosting, and no new dependency
  were added.

## Alternatives considered

**Persist a category column in Supabase.** Rejected: it would require a new migration and a new
Edge Function action, and it would put category data one refactor away from trust assembly. Keeping
categories in the view layer makes the non-escalation guarantee structural.

**Let an LLM categorise resources.** Rejected outright. It would add a runtime model dependency
`AGENTS.md` forbids, and make a user-visible attribute non-deterministic.

**Auto-ingest federated results into the catalog on page load.** Rejected: it would make every page
load depend on three upstream APIs, and would fill the catalog with rows AegisOne holds no evidence
for — recreating the "full of demo data" problem with live data instead of fixtures.

**Wrap the cookbook file as a valid `SKILL.md`.** Rejected: it would manufacture a passing
validation that is not true. Showing the real failure is the product working correctly.
