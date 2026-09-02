// Shared HTML shell for the AegisOne Hub: the nav rail, the one content column, the footer, the
// single stylesheet and the shared illustration sprite. Every page renders through here.
//
// VISUAL LANGUAGE — "playful neo-brutalist", applied as a *product system*, not as four posters.
// The design language is meant to be recognisable through proportion, typography, spacing,
// linework, palette and interaction behaviour — not by repeating the same tricks (a diagonal, a
// pill row, a floating cube, a giant yellow field) on every route. Concretely:
//
//   - Yellow is a brand accent on chrome (primary CTA, one active state, one deliberate field).
//     It is never the ground of a page and never a trust state.
//   - There is ONE expressive hero in the product, and it belongs to SKILLS, the entry point.
//     AUDIT / VERIFIED / FOR AGENTS get short editorial page headers so the tool or the list
//     reaches the first viewport instead of a 700px poster.
//   - The whole page is not wrapped in one giant white rectangle. Content sits on paper; a frame
//     is used only where a framed composition is doing a compositional job.
//   - Every decorative object must answer "what compositional or conceptual job is this doing?"
//     If it cannot, it is deleted rather than kept and shrunk.
//
// ILLUSTRATION METAPHOR — one family for the whole product: an outlined **stamp** ring (the seal
// AegisOne presses only when real evidence exists) plus a **byte grid** (the bytes it actually
// compares) and a comparison arrow. A stamp implies a claim, so it is only ever drawn where
// genuine evidence warrants it — never as decoration.
//
// The **brand mark is a separate thing** and is NOT drawn here: it is the repo owner's real logo
// file, `apps/web/public/brand/logo.jpg`, served at `/static/brand/logo.jpg` (see `brandLogoImg`).
// Verdict illustration must never be mistaken for brand identity.
//
// TRUST-STATE COLOUR. Colour NEVER carries a verdict on its own — `badges.mjs` always pairs a
// glyph AND a text label with every state; this palette only makes the already-textual state
// faster to scan:
//   cyan      #22DCEB  affirmative / proven      MATCH, REPOSITORY_AUTHENTICATED, SIGNED_RELEASE, ALLOW, CLEAN
//   lavender  #B79CFF  discovery-only / info     INDEXED, canonical evidence AVAILABLE
//   amber     #F5A524  caution / needs review    DECLARED, DIVERGED, STALE, INSUFFICIENT_EVIDENCE, REVIEW, FLAGGED
//   alarm     #FF4A3D  negative                  MISMATCH, DENY, BLACKLISTED, integrity failure
//   paper/ink          neutral / absent          NONE, NOT_EVALUATED, AUDIT NOT RUN
// Brand yellow #FFD91A is deliberately reserved for chrome, so "the yellow thing" never reads as
// a verdict.

export interface LayoutOptions {
  title: string;
  activeNav: "skills" | "audit" | "verified" | "agents" | "resource" | "source-claim" | "none";
  bodyHtml: string;
  /** A raw <script> tag (already trusted, authored by this codebase) appended before </body>. */
  scriptTag?: string;
}
/**
 * ONE stylesheet, organised as a small primitive vocabulary rather than a per-route dump.
 *
 * The composition rule this file enforces (the previous version did not): **product UI first,
 * brand expression second**. Roughly 70% disciplined structure, 30% controlled disruption. Yellow
 * is a brand accent on chrome — a CTA, one field, one active state — never the ground of a page.
 * Every page therefore paints on paper, aligns to one content column, and spends its single
 * expressive move where that page's job actually is.
 *
 * Sections below, in order:
 *   1. tokens          2. base/reset      3. shell (rail + main + footer)
 *   4. typography      5. controls        6. surfaces (panel/frame/chip/badge)
 *   7. page header     8. search + catalog   9. tool split (audit)  10. registry (verified)
 *  11. docs (agents)  12. evidence passport  13. misc pages  14. motion  15. responsive
 */
const STYLE = `
/* ── 1. tokens ─────────────────────────────────────────────────────────────── */
:root{
  --ink:#0a0a0a; --ink-soft:#4a463e;
  --paper:#f7f5ef; --paper-deep:#eceadf; --card:#fffdf8;
  --yellow:#ffd91a; --lavender:#b79cff; --cyan:#22dceb; --periwinkle:#d8e1ff;
  --amber:#f5a524; --alarm:#ff4a3d;
  --tone-neutral:#e6e2d6; --tone-info:var(--lavender); --tone-positive:var(--cyan);
  --tone-caution:var(--amber); --tone-negative:var(--alarm);
  --line:2px; --line-thick:3px;
  --border:var(--line) solid var(--ink);
  --radius-lg:26px; --radius-md:16px; --radius-sm:10px;
  --hard-shadow:6px 6px 0 var(--ink);
  --hard-shadow-sm:3px 3px 0 var(--ink);
  --rail:78px;
  --measure:1240px;
  --gutter:clamp(20px,3.4vw,52px);
  font-family:"Archivo","Helvetica Neue",Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;
  color-scheme:light;
}

/* ── 2. base ───────────────────────────────────────────────────────────────── */
*{box-sizing:border-box}
body{
  margin:0;background:var(--paper);color:var(--ink);line-height:1.5;
  -webkit-font-smoothing:antialiased;
  background-image:radial-gradient(#e3dfd2 1.2px, transparent 1.2px);
  background-size:26px 26px;
}
a{color:var(--ink);text-decoration:none;text-underline-offset:3px}
a:hover{text-decoration:underline}
img,svg{max-width:100%}
.sprite{position:absolute;width:0;height:0;overflow:hidden}
.skiplink{position:absolute;left:-9999px;top:0;background:var(--yellow);border:var(--border);padding:10px 16px;font-weight:800;z-index:99}
.skiplink:focus{left:12px;top:12px}
:focus-visible{outline:3px solid var(--ink);outline-offset:3px}
.visually-hidden{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
/* The hidden attribute is how AUDIT shows one workflow at a time and how the catalog hides
   filtered rows, so it must beat every later display rule in this stylesheet. */
[hidden]{display:none !important}

/* ── 3. shell ──────────────────────────────────────────────────────────────
   A slim numbered rail and one content column. Deliberately NOT "one giant white rectangle
   around an endless page": the page paints on paper, and a frame is used only where a framed
   composition is doing a compositional job (the SKILLS hero). */
.page{display:grid;grid-template-columns:var(--rail) minmax(0,1fr);min-height:100vh;align-content:start}
.rail{
  position:sticky;top:0;align-self:start;height:100vh;
  display:flex;flex-direction:column;align-items:center;gap:26px;
  padding:18px 8px;border-right:var(--line) solid var(--ink);background:var(--card);
}
.brandMark{display:inline-grid;place-items:center;width:var(--brand-size,48px);height:var(--brand-size,48px);border:var(--border);border-radius:12px;background:#fff;overflow:hidden;flex:none;transition:transform 180ms ease, box-shadow 180ms ease}
.brandMark img{display:block;width:100%;height:100%;object-fit:contain}
a:hover .brandMark{transform:translate(-2px,-2px);box-shadow:var(--hard-shadow-sm)}
.railNav{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px;align-items:stretch;width:100%}
.railNav a{
  display:flex;flex-direction:column;align-items:center;gap:4px;
  padding:9px 2px;border-radius:12px;border:var(--line) solid transparent;
  font-size:9.5px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;
  line-height:1.15;text-align:center;color:var(--ink-soft);
  transition:background 160ms ease,color 160ms ease;
}
.railNum{display:grid;place-items:center;width:30px;height:30px;border:var(--border);border-radius:9px;background:var(--paper);font-size:11px;font-weight:900;transition:background 160ms ease}
.railNav a:hover{text-decoration:none;color:var(--ink);background:var(--paper)}
.railNav a.active{color:var(--ink);background:var(--paper-deep);border-color:var(--ink)}
.railNav a.active .railNum{background:var(--yellow)}
.railLabel{display:block}

.col{min-width:0;display:flex;flex-direction:column;min-height:100vh}
.main{width:100%;max-width:var(--measure);margin:0 auto;padding:clamp(22px,3vw,40px) var(--gutter) 0;min-width:0}
.topbar{display:none}
.footer{
  width:100%;max-width:var(--measure);margin:auto auto 0;display:flex;justify-content:space-between;flex-wrap:wrap;gap:14px;
  padding:26px var(--gutter) 30px;font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--ink-soft);
  border-top:var(--line) solid var(--ink);margin-top:56px;
}
.footer span{max-width:78ch}

/* ── 4. typography ─────────────────────────────────────────────────────────
   Two levels of page introduction only. "h1.hero" is the single largest headline in the product
   and belongs to SKILLS, the primary entry point. "h1" on a tool/docs page is a step smaller so
   the tool itself reaches the first viewport. */
h1,h2,h3{margin:0;letter-spacing:-.04em;font-weight:900}
h1{font-size:clamp(30px,3.9vw,46px);line-height:1.02;margin:0 0 12px;max-width:22ch}
h1.hero{font-size:clamp(36px,5vw,62px);line-height:.98;max-width:16ch}
h1.tight{max-width:20ch}
h2{font-size:clamp(19px,2.1vw,27px);line-height:1.05;margin:0 0 12px}
h3{font-size:clamp(16px,1.5vw,20px);line-height:1.1}
p{color:var(--ink-soft);max-width:66ch;font-size:15px}
.lede{font-size:clamp(15px,1.35vw,17px);color:var(--ink);font-weight:500;max-width:56ch}
.mark{background:var(--cyan);border:var(--line) solid var(--ink);border-radius:7px;padding:0 .16em;display:inline-block;transform:rotate(-1deg)}
.mark--yellow{background:var(--yellow)}
.eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:11px;font-weight:900;letter-spacing:.18em;text-transform:uppercase;color:var(--ink-soft)}
.edgeLabel{display:inline-block;background:var(--ink);color:var(--paper);font-size:10px;font-weight:900;letter-spacing:.16em;text-transform:uppercase;padding:4px 10px;border-radius:5px;margin-bottom:10px}
.note{font-size:12.5px;color:var(--ink-soft);margin:10px 0 0;max-width:72ch}
code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}

/* ── 5. controls ───────────────────────────────────────────────────────────
   One obvious primary per viewport: yellow fill, black outline, a physical press. */
.button{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:11px 20px;border:var(--border);border-radius:999px;background:var(--card);color:var(--ink);font-weight:800;font-size:14px;letter-spacing:-.01em;cursor:pointer;font-family:inherit;transition:transform 150ms ease, box-shadow 150ms ease}
.button:hover{text-decoration:none;transform:translate(-2px,-2px);box-shadow:var(--hard-shadow-sm)}
.button:active{transform:translate(1px,1px);box-shadow:none}
.button--primary{background:var(--yellow)}
.button--lg{padding:15px 30px;font-size:16px}
.button--sm{padding:7px 14px;font-size:12.5px}
.button[disabled]{opacity:.45;cursor:not-allowed}
.button[disabled]:hover{transform:none;box-shadow:none}
.button .arrow{transition:transform 150ms ease}
.button:hover .arrow{transform:translateX(3px)}
.ctaRow{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.textLink{font-size:13px;font-weight:800;border-bottom:var(--line) solid var(--ink);padding-bottom:1px}
.textLink:hover{text-decoration:none;background:var(--yellow)}

.pill{display:inline-flex;align-items:center;gap:6px;border:var(--border);border-radius:999px;padding:4px 11px;font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;background:var(--card)}
.pill--yellow{background:var(--yellow)}
.pill--peri{background:var(--periwinkle)}
.pill--cat{background:var(--periwinkle)}
.pillRow{display:flex;flex-wrap:wrap;gap:7px;margin:0 0 14px}

/* A two-state mode switch. Server-rendered links, so switching modes cannot lose or mis-submit
   state and works with JavaScript off. */
.modeSwitch{display:inline-flex;border:var(--line-thick) solid var(--ink);border-radius:999px;background:var(--card);padding:4px;gap:4px;margin:0 0 22px}
.modeSwitch a{padding:9px 20px;border-radius:999px;font-size:13.5px;font-weight:900;letter-spacing:-.01em;color:var(--ink-soft)}
.modeSwitch a:hover{text-decoration:none;background:var(--paper-deep);color:var(--ink)}
.modeSwitch a[aria-current="page"]{background:var(--yellow);color:var(--ink);box-shadow:inset 0 0 0 var(--line) var(--ink)}

/* ── 6. surfaces ───────────────────────────────────────────────────────────── */
.frame{border:var(--line-thick) solid var(--ink);border-radius:var(--radius-lg);background:var(--card);padding:clamp(22px,2.8vw,40px);position:relative}
.panel{border:var(--border);border-radius:var(--radius-md);background:var(--card);padding:20px 22px;position:relative}
.panel--flat{background:var(--paper)}
.section{margin-top:clamp(30px,4vw,52px)}
.sectionHeadRow{display:flex;justify-content:space-between;align-items:baseline;gap:16px;flex-wrap:wrap;margin-bottom:6px;border-bottom:var(--line-thick) solid var(--ink);padding-bottom:8px}
.sectionNote{font-size:13px;margin:10px 0 16px;max-width:74ch}
.hatch{background-image:repeating-linear-gradient(45deg,var(--ink) 0 2px,transparent 2px 8px);opacity:.28}
.emptyState{font-size:14px;font-weight:600;color:var(--ink-soft);border:var(--line) dashed var(--ink);border-radius:var(--radius-sm);padding:16px;background:var(--paper)}
.errorText{color:var(--ink);font-weight:800;border-left:var(--line-thick) solid var(--alarm);padding-left:12px}
details.disclose{border-top:1px dotted rgba(10,10,10,.25);margin-top:10px}
details.disclose > summary{cursor:pointer;list-style:none;padding:8px 0;font-size:11px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-soft)}
details.disclose > summary::-webkit-details-marker{display:none}
details.disclose > summary::before{content:"+ ";font-weight:900}
details.disclose[open] > summary::before{content:"– "}
details.disclose > summary:hover{color:var(--ink)}

/* state chips — see badges.mjs: colour never carries a verdict on its own */
.badge{display:inline-flex;align-items:center;gap:6px;border:var(--border);border-radius:999px;padding:3px 10px;font-size:10.5px;font-weight:900;letter-spacing:.04em;text-transform:uppercase;background:var(--tone-neutral);color:var(--ink);white-space:nowrap}
.badge--neutral{background:var(--tone-neutral)}
.badge--positive{background:var(--tone-positive)}
.badge--negative{background:var(--tone-negative)}
.badge--caution{background:var(--tone-caution)}
.badge--info{background:var(--tone-info)}
.badge__glyph{font-size:10px;line-height:1}

/* ── 7. page header ───────────────────────────────────────────────────────
   The editorial header used by AUDIT / VERIFIED / FOR AGENTS: eyebrow, headline, one line of
   context, a rule. Short on purpose — the tool must start inside the first viewport. */
.pageHead{padding-bottom:18px;border-bottom:var(--line-thick) solid var(--ink);margin-bottom:24px}
.pageHead .eyebrow{margin-bottom:10px}
.pageHead p{margin:0}
.pageHeadRow{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;flex-wrap:wrap}
.pageHeadRow > *:first-child{min-width:min(100%,32ch);flex:1 1 380px}
/* One small header object per page: character without a poster. It is the page's single
   illustration, sized so the tool below it still starts inside the first viewport. */
.pageHeadArt{width:100%;max-width:230px;flex:0 1 230px}
.pageHeadArt svg{width:100%;height:auto;display:block;overflow:visible}

/* ── 8. SKILLS: hero, search, catalog ──────────────────────────────────────
   The framed hero is the product's one poster moment, and it exists to hold the search field —
   the strongest interactive object in the product. */
.heroPanel{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,.65fr);gap:clamp(20px,3vw,44px);align-items:center}
.heroArt{justify-self:center;width:100%;max-width:330px}
.heroArt svg{width:100%;height:auto;display:block;overflow:visible}
.searchForm{display:flex;gap:10px;margin:20px 0 12px;max-width:660px}
.searchForm input[type="search"]{flex:1;min-width:0;padding:16px 22px;border:var(--line-thick) solid var(--ink);border-radius:999px;font-size:16.5px;font-family:inherit;background:var(--paper);color:var(--ink);font-weight:600;box-shadow:var(--hard-shadow-sm)}
.searchForm input[type="search"]::placeholder{color:var(--ink-soft);font-weight:500}
.searchForm input[type="search"]:focus{background:var(--card)}
.searchScope{display:flex;flex-wrap:wrap;gap:10px 18px;align-items:center;font-size:12.5px;color:var(--ink-soft);margin:0}
.searchScope label{display:inline-flex;gap:8px;align-items:center;font-weight:700}
.searchScope input[type="checkbox"]{width:16px;height:16px;accent-color:var(--ink)}
.exampleRow{display:flex;flex-wrap:wrap;gap:7px;align-items:center;margin:0 0 12px;font-size:12px;color:var(--ink-soft);font-weight:800;letter-spacing:.06em;text-transform:uppercase}
.exampleChip{font-family:inherit;cursor:pointer;text-transform:none;letter-spacing:0;font-size:12px;transition:transform 150ms ease, box-shadow 150ms ease}
.exampleChip:hover:not([disabled]){transform:translate(-2px,-2px);box-shadow:var(--hard-shadow-sm)}
.crossLink{margin:14px 0 0;font-size:13px;color:var(--ink-soft)}

.catRail{display:flex;flex-wrap:wrap;gap:7px;margin:0 0 18px}
.catChip{font-family:inherit;cursor:pointer;text-transform:none;letter-spacing:0;font-size:12px;display:inline-flex;gap:6px;align-items:center;transition:transform 150ms ease, box-shadow 150ms ease}
.catChip:hover:not([disabled]){transform:translate(-2px,-2px);box-shadow:var(--hard-shadow-sm)}
.catChip--active{background:var(--yellow);box-shadow:var(--hard-shadow-sm)}
.catChip--empty,.catChip[disabled]{opacity:.4;cursor:not-allowed}
.catCount{font-size:10px;font-weight:900;border:1px solid var(--ink);border-radius:999px;padding:0 6px;background:var(--paper)}
.catChip--active .catCount{background:var(--card)}

/* The catalog is the content of this page: rule-separated editorial rows, not a card grid. */
.library{list-style:none;margin:0;padding:0;border-top:var(--line-thick) solid var(--ink)}
.libRow{display:grid;grid-template-columns:64px minmax(0,1fr) auto;gap:6px 20px;align-items:start;padding:20px 6px;border-bottom:var(--line) solid var(--ink);transition:background 160ms ease}
.libRow:hover{background:var(--card)}
.libRow[hidden]{display:none}
.libArt{display:block;width:64px;height:64px;border:var(--border);border-radius:14px;background:var(--paper);padding:5px;transform:rotate(-3deg);transition:transform 200ms ease}
.libArt svg{width:100%;height:100%;display:block;overflow:visible}
.libRow:hover .libArt{transform:rotate(2deg)}
.libIndex{display:none}
.libBody{min-width:0}
.libHead{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:5px}
.libHead h3{margin:0;font-size:clamp(17px,1.8vw,22px);letter-spacing:-.03em}
.libDesc{font-size:13.5px;margin:0 0 10px;max-width:70ch}
.libMeta{display:flex;flex-wrap:wrap;gap:9px;align-items:center;margin-bottom:10px}
.libBy{font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-soft)}
.libBy--unknown{border:1px dashed var(--ink);border-radius:999px;padding:2px 8px}
.libDims{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}
.libFacts{display:flex;flex-wrap:wrap;gap:6px 22px;margin:0 0 10px}
.libFact{display:flex;gap:8px;align-items:baseline}
.libFact dt{font-size:10px;font-weight:900;letter-spacing:.09em;text-transform:uppercase;color:var(--ink-soft)}
.libFact dd{margin:0}
.libFactValue{font-size:12.5px;font-weight:700}
.libFactValue--mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;background:var(--paper-deep);border:1px solid var(--ink);border-radius:5px;padding:1px 6px;display:inline-block}
/* "unknown" is a real rendered word, never an empty cell — a blank would read as "fine". */
.libFactValue--unknown{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:var(--ink-soft);border:1px dashed var(--ink);border-radius:5px;padding:1px 7px;display:inline-block}
.libUrl{font-size:11.5px;word-break:break-all;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;margin:0}
.libActions{align-self:center;justify-self:end}
.libCta{font-size:12.5px;padding:8px 15px;white-space:nowrap}
.libCta--none{font-size:11.5px;font-weight:700;color:var(--ink-soft);border:1px dashed var(--ink);border-radius:999px;padding:6px 12px;display:inline-block;max-width:22ch;text-align:center;white-space:normal}
.kindTag{font-size:9.5px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;border:1px solid var(--ink);border-radius:5px;padding:2px 6px;white-space:nowrap;background:var(--paper)}

/* Search results replace the catalog in place — same editorial rhythm, so the page does not
   change shape when a query runs. */
.resultList{display:flex;flex-direction:column;border-top:var(--line-thick) solid var(--ink)}
.resultCard{position:relative;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px 20px;padding:18px 18px 18px 22px;border-bottom:var(--line) solid var(--ink);background:var(--card);transition:background 160ms ease}
.resultCard:hover{background:var(--periwinkle)}
.resultCard::before{content:"";position:absolute;left:0;top:0;bottom:0;width:6px;background:var(--cyan)}
.resultCard--discoveryOnly::before{background-image:repeating-linear-gradient(45deg,var(--ink) 0 2px,transparent 2px 7px);background-color:var(--paper-deep)}
.cardHead{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
.cardHead h3{margin:0;letter-spacing:-.03em}
.cardDescription{font-size:13.5px;margin:6px 0 0;max-width:72ch}
.cardBadges{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 0;grid-column:1 / -1}
.cardNote{font-size:12px;font-weight:700;color:var(--ink-soft);align-self:center}
.cardMeta{display:flex;gap:12px;flex-wrap:wrap;font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--ink-soft);grid-column:1 / -1;margin-top:8px}
.relevance{border:1px dashed var(--ink);border-radius:999px;padding:2px 9px;background:var(--paper)}
.cardUrl{grid-column:1 / -1;margin-top:6px;font-size:11.5px;word-break:break-all;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.cardStamp{align-self:start;width:46px;height:46px;flex:none}
.cardStamp svg{width:100%;height:100%;display:block}
.providerStatusList{list-style:none;padding:0;margin:0 0 14px;display:flex;flex-wrap:wrap;gap:7px}
.providerStatus{font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;border:var(--border);border-radius:999px;padding:4px 10px;background:var(--card)}
.providerStatus--ok{background:var(--periwinkle)}
.providerStatus--down{background:var(--amber)}

/* ── 9. AUDIT: the split tool layout ───────────────────────────────────────
   Left is what you give it, right is what it says back. One workflow is visible at a time; the
   mode switch above swaps them, so neither has to be scrolled past to reach the other. */
.toolSplit{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:clamp(18px,2.4vw,32px);align-items:start}
.toolSplit > *{min-width:0}
.toolMode{display:block}
/* Capabilities that do not exist get one muted line, never a card, a pill or a dead control. */
.upcomingLine{font-size:12px;color:var(--ink-soft);margin:clamp(28px,4vw,44px) 0 0;padding-top:12px;border-top:1px dashed var(--ink);max-width:80ch}
.scanInput{width:100%;min-height:340px;padding:15px 17px;border:var(--line-thick) solid var(--ink);border-radius:var(--radius-md);background:var(--paper);color:var(--ink);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;line-height:1.55;resize:vertical}
.scanControls{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-top:14px}
.scanOption{display:flex;gap:9px;align-items:flex-start;border:var(--line) dashed var(--ink);border-radius:var(--radius-sm);padding:9px 12px;background:var(--paper);max-width:42ch}
.scanOption input[type="checkbox"]{width:17px;height:17px;margin-top:2px;flex:none;accent-color:var(--ink)}
.scanOption span{font-size:12px;font-weight:600;color:var(--ink)}
.scanOption strong{display:block;font-size:11px;font-weight:900;letter-spacing:.07em;text-transform:uppercase;margin-bottom:2px}
.verdictStamp{display:grid;place-items:center;width:clamp(110px,15vw,150px);height:auto;margin:0 auto 4px;transform:rotate(-6deg)}
.verdictStamp svg{width:100%;height:auto;display:block}
.verdictPanel{border:var(--line-thick) solid var(--ink);border-radius:var(--radius-md);padding:22px;background:var(--card);text-align:center}
.verdictPanel--CLEAN{background:var(--cyan)}
.verdictPanel--FLAGGED{background:var(--amber)}
.verdictPanel--BLACKLISTED{background:var(--alarm)}
.verdictWord{font-size:clamp(26px,3.6vw,44px);font-weight:900;letter-spacing:-.05em;line-height:1;margin:8px 0 6px}
.verdictMeaning{font-size:13px;font-weight:700;color:var(--ink);margin:0 auto;max-width:44ch}
.scanMetaRow{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:14px}
.advisoryPanel{border:var(--line) dashed var(--ink);border-radius:var(--radius-md);padding:16px;background:var(--paper);margin-top:16px}
.advisoryPanel h3{font-size:15px;margin-bottom:6px}
.advisoryStamp{font-size:11px;font-weight:900;letter-spacing:.11em;text-transform:uppercase;border:1px dashed var(--ink);border-radius:999px;padding:4px 11px;display:inline-block;background:var(--card)}
.advisoryBody{font-size:13px;font-weight:600;margin:10px 0 0;white-space:pre-wrap;word-break:break-word}
.findingRow{display:grid;grid-template-columns:auto minmax(0,1fr);gap:12px;align-items:start;padding:12px 0;border-bottom:var(--line) solid var(--ink)}
.findingRow:last-child{border-bottom:0}
.findingSeverity{font-size:10px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;border:var(--border);border-radius:999px;padding:3px 9px;white-space:nowrap;background:var(--tone-neutral)}
.findingSeverity--CRITICAL,.findingSeverity--HIGH{background:var(--alarm)}
.findingSeverity--MEDIUM{background:var(--amber)}
.findingSeverity--LOW,.findingSeverity--INFO{background:var(--tone-neutral)}
.findingBody h4{margin:0 0 4px;font-size:14px;letter-spacing:-.02em}
.findingMeta{font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--ink-soft);margin:0 0 6px}
.findingEvidence{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;background:var(--paper-deep);border:1px solid var(--ink);border-radius:6px;padding:6px 9px;margin:0;overflow-x:auto;white-space:pre-wrap;word-break:break-word}
.findingExplain{font-size:12.5px;margin:6px 0 0}
.verifyTargets{display:flex;flex-direction:column;gap:8px;margin:14px 0 0;max-height:320px;overflow:auto;border:var(--line) solid var(--ink);border-radius:var(--radius-sm);padding:12px;background:var(--paper)}
.verifyTarget{display:flex;gap:10px;align-items:flex-start;font-size:13px;font-weight:600;padding:8px;border-radius:var(--radius-sm);cursor:pointer}
.verifyTarget:hover{background:var(--card)}
.verifyTarget input[type="radio"]{margin-top:3px;width:16px;height:16px;flex:none;accent-color:var(--ink)}
.verifyTargetBody{display:flex;flex-direction:column;gap:3px;min-width:0}
.verifyTargetMeta{font-size:11.5px;color:var(--ink-soft);word-break:break-word}
.verifyPanel{margin:0}

/* ── 10. VERIFIED: the evidence registry ───────────────────────────────────
   Four independent facts, never merged. An established state gets a filled glyph and a flat
   accent field; an unestablished one gets a hollow glyph, a dashed outline and the words "not
   established" — the distinction survives with colour removed, in a screen reader, and in print.
   None of the accents is green: there is no "all clear" colour because there is no all-clear
   claim. */
.stateKey{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));border:var(--line) solid var(--ink);border-radius:var(--radius-md);overflow:hidden;background:var(--card);margin:0 0 20px}
.stateKeyItem{padding:12px 14px;border-right:var(--line) solid var(--ink);display:flex;flex-direction:column;gap:4px}
.stateKeyItem:last-child{border-right:0}
.stateKeyLabel{font-size:11px;font-weight:900;letter-spacing:.09em;text-transform:uppercase}
.stateKeyMeaning{font-size:11.5px;line-height:1.45;color:var(--ink)}
.stateKeyItem--INDEXED{background:var(--lavender)}
.stateKeyItem--AUDITED{background:var(--periwinkle)}
.stateKeyItem--VERIFIED{background:var(--cyan)}
.stateKeyItem--STORED_ON_0G{background:var(--yellow)}
.filterBar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 4px;padding-bottom:14px}
.filterBar .eyebrow{margin-right:4px}
.filterChip{font-family:inherit;cursor:pointer;text-transform:none;letter-spacing:0;font-size:12.5px;transition:transform 150ms ease, box-shadow 150ms ease}
.filterChip:hover{transform:translate(-2px,-2px);box-shadow:var(--hard-shadow-sm)}
.filterChip--active{background:var(--yellow);box-shadow:var(--hard-shadow-sm)}
.stateLedger{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}
.stateChip{display:inline-flex;align-items:center;gap:6px;font-size:10.5px;font-weight:900;letter-spacing:.05em;text-transform:uppercase;border:1px solid var(--ink);border-radius:999px;padding:4px 11px;background:var(--paper)}
.stateChip__glyph{font-size:8px;line-height:1}
.stateChip--on.stateChip--INDEXED{background:var(--lavender)}
.stateChip--on.stateChip--AUDITED{background:var(--periwinkle)}
.stateChip--on.stateChip--VERIFIED{background:var(--cyan)}
.stateChip--on.stateChip--STORED_ON_0G{background:var(--yellow)}
.stateChip--off{border-style:dashed;color:var(--ink-soft);background:transparent;font-weight:800}
.stateChip__not{font-weight:700;letter-spacing:.03em;text-transform:none;opacity:.75}
.absenceList{list-style:none;margin:8px 0 0;padding:10px 14px;border-left:var(--line-thick) solid var(--ink);background:var(--paper-deep);border-radius:0 var(--radius-sm) var(--radius-sm) 0;display:flex;flex-direction:column;gap:5px}
.absenceList li{font-size:12px;line-height:1.5}
.pubBlock{border:var(--line) solid var(--ink);border-radius:var(--radius-sm);background:var(--card);padding:12px 14px;margin:8px 0 0}
.pubNote{font-size:11.5px;margin:8px 0 0;color:var(--ink-soft);line-height:1.5}
.tallyStrip{display:flex;flex-wrap:wrap;gap:10px;margin:0 0 18px}
.tally{border:var(--border);border-radius:var(--radius-sm);padding:8px 16px;background:var(--paper);display:flex;flex-direction:column;gap:1px;min-width:96px}
.tally--zerog{background:var(--yellow)}
.tallyNum{font-size:26px;font-weight:900;letter-spacing:-.05em;line-height:1}
.tallyLabel{font-size:10px;font-weight:900;letter-spacing:.09em;text-transform:uppercase;color:var(--ink-soft)}
.tally--zerog .tallyLabel{color:var(--ink)}

/* ── 11. FOR AGENTS: integration docs ─────────────────────────────────────── */
.miniNav{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 26px;padding-bottom:16px;border-bottom:var(--line) solid var(--ink)}
.miniNav a{font-size:11.5px;font-weight:800;letter-spacing:.04em;border:var(--line) solid var(--ink);border-radius:999px;padding:5px 12px;background:var(--card)}
.miniNav a:hover{text-decoration:none;background:var(--yellow)}
.pathGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;margin:0 0 8px}
.pathCard{border:var(--line-thick) solid var(--ink);border-radius:var(--radius-md);background:var(--card);padding:18px 20px;display:flex;flex-direction:column;gap:8px}
.pathCard--primary{background:var(--periwinkle)}
.pathCard h3{margin:0}
.pathCard p{font-size:13px;margin:0;max-width:44ch}
.pathCard .ctaRow{margin-top:auto;padding-top:8px}
.toolList{list-style:none;margin:12px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:7px}
.toolList li{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;border:var(--line) solid var(--ink);border-radius:999px;padding:4px 11px;background:var(--card);font-weight:700}
.toolList--denied li{background:transparent;border-style:dashed;color:var(--ink-soft);text-decoration:line-through}
.endpointList{list-style:none;margin:14px 0 0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));border:var(--line) solid var(--ink);border-radius:var(--radius-md);overflow:hidden;background:var(--card)}
.endpoint{padding:13px 15px;border-right:var(--line) solid var(--ink);border-bottom:var(--line) solid var(--ink)}
.endpoint h3{margin:0 0 4px;font-size:13.5px}
.endpoint p{font-size:12px;margin:0 0 7px;max-width:46ch}
.endpointUrl{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;background:var(--paper);border:1px solid var(--ink);border-radius:5px;padding:4px 7px;display:block;word-break:break-all;font-weight:700}
/* Code: ink field, paper text, scrolling inside its own box so the page never scrolls sideways. */
.codeCard{border:var(--line) solid var(--ink);border-radius:var(--radius-sm);overflow:hidden;margin:12px 0 0;background:var(--ink)}
.codeHead{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:7px 12px;background:var(--yellow);color:var(--ink);border-bottom:var(--line) solid var(--ink);font-size:10px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}
.codeHead--in{background:var(--cyan)}
.codeHead--out{background:var(--periwinkle)}
.codeHead--refuse{background:var(--alarm)}
.codeCard pre{margin:0;padding:14px 16px;overflow-x:auto;color:var(--paper);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;line-height:1.6;tab-size:2}
.codeCard code{font:inherit;color:inherit;background:none;border:0;padding:0}
.copyButton{font-family:inherit;font-size:10px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;border:1px solid var(--ink);border-radius:999px;background:var(--card);color:var(--ink);padding:3px 10px;cursor:pointer;transition:transform 150ms ease,box-shadow 150ms ease}
.copyButton:hover{transform:translate(-1px,-1px);box-shadow:2px 2px 0 var(--ink)}
.copyButton[hidden]{display:none}
/* The safety boundary is a deliberate technical callout, not another marketing panel. */
.boundary{border:var(--line-thick) solid var(--ink);border-radius:var(--radius-md);background:var(--card);padding:clamp(18px,2.4vw,28px);position:relative;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,.7fr);gap:clamp(18px,2.6vw,32px);align-items:center}
.boundary::before{content:"";position:absolute;left:0;top:18px;bottom:18px;width:8px;background:var(--alarm);border-right:var(--line) solid var(--ink)}
.boundary h2{max-width:20ch}
.boundaryArt{width:100%;max-width:340px;justify-self:center}
.boundaryArt svg{width:100%;height:auto;display:block}
.agentArt{width:100%;max-width:340px}
.agentArt svg{width:100%;height:auto;display:block;overflow:visible}
.notProvenList{padding-left:20px;margin:10px 0 0;font-size:13px}
.notProvenList li{margin-bottom:8px;max-width:80ch}

/* ── 12. evidence passport ─────────────────────────────────────────────────
   The one place complexity is allowed. Directory = summary; passport = proof. */
.passportHead{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:24px;align-items:start;margin-bottom:24px}
.passportStamp{width:clamp(84px,11vw,128px);height:auto;flex:none;transform:rotate(-7deg)}
.passportStamp svg{width:100%;height:auto;display:block}
.evidenceSummary{border:var(--line-thick) solid var(--ink);border-radius:var(--radius-md);background:var(--card);padding:18px clamp(16px,2vw,24px);margin-bottom:20px}
.summaryRows{display:grid;margin:0}
.summaryRow{display:grid;grid-template-columns:180px minmax(0,1fr);gap:14px;align-items:center;padding:8px 0;border-bottom:1px dotted rgba(10,10,10,.18)}
.summaryRow:last-child{border-bottom:0}
.summaryLabel{font-size:11px;font-weight:900;letter-spacing:.09em;text-transform:uppercase;color:var(--ink-soft)}
.summaryValue{display:flex;flex-wrap:wrap;gap:7px;align-items:center;font-size:13px;font-weight:700}
.summaryNote{font-size:12.5px;margin:12px 0 0;font-weight:600}
.passportRun{display:grid;border:var(--line) solid var(--ink);border-radius:var(--radius-md);background:var(--card)}
.passportSection{position:relative;border-bottom:var(--line) solid var(--ink)}
.passportSection:last-child{border-bottom:0}
.passportSection:nth-child(even){background:var(--paper)}
.passportSection > *:not(summary){margin-left:clamp(14px,2vw,26px);margin-right:clamp(14px,2vw,26px)}
.passportSection > *:last-child{margin-bottom:20px}
.passportSection h2{font-size:clamp(16px,1.6vw,20px);margin:0}
.sectionMark{display:flex;align-items:center;gap:12px;padding:14px clamp(14px,2vw,26px);cursor:pointer;list-style:none;user-select:none}
.sectionMark::-webkit-details-marker{display:none}
.sectionMark:hover{background:var(--periwinkle)}
.sectionMark .idx{width:28px;height:28px;flex:none;border:var(--border);border-radius:8px;display:grid;place-items:center;font-size:11px;font-weight:900;background:var(--card)}
.sectionMark .disclose{margin-left:auto;font-size:11px;font-weight:900;letter-spacing:.09em;text-transform:uppercase;color:var(--ink-soft);white-space:nowrap}
.passportSection[open] .sectionMark .disclose::after{content:"– hide"}
.passportSection:not([open]) .sectionMark .disclose::after{content:"+ detail"}
.fieldRow{display:grid;grid-template-columns:220px minmax(0,1fr);gap:14px;padding:7px 0;font-size:13.5px;align-items:baseline;border-bottom:1px dotted rgba(10,10,10,.18)}
.fieldRow:last-of-type{border-bottom:0}
.fieldLabel{font-size:11px;font-weight:900;letter-spacing:.09em;text-transform:uppercase;color:var(--ink-soft)}
.fieldValue{font-weight:600;word-break:break-word}
.hashRow{display:grid;grid-template-columns:220px minmax(0,1fr);gap:14px;padding:6px 0;align-items:baseline;border-bottom:1px dotted rgba(10,10,10,.18)}
.hashLabel{font-size:11px;font-weight:900;letter-spacing:.09em;text-transform:uppercase;color:var(--ink-soft)}
.hashValue{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;word-break:break-all;background:var(--paper-deep);border:1px solid var(--ink);border-radius:5px;padding:1px 6px}
.hashValue--empty{background:transparent;border-style:dashed;color:var(--ink-soft)}
.passportDescription,.passportNote{font-size:13px;margin:10px 0 0}
.passportWarning{font-size:13px;margin:12px 0 0;border-left:var(--line-thick) solid var(--amber);background:var(--paper-deep);padding:9px 13px;border-radius:0 8px 8px 0;color:var(--ink);font-weight:600}
.integrityWarning{font-size:13px;margin:12px 0 0;border-left:var(--line-thick) solid var(--alarm);background:var(--paper-deep);padding:9px 13px;border-radius:0 8px 8px 0;color:var(--ink);font-weight:700}
.findingList{font-size:13px;padding-left:20px;margin:10px 0 0}
.findingList li{margin-bottom:6px;max-width:80ch}
.historyList{list-style:none;padding:0;margin:10px 0 0;display:flex;flex-direction:column;gap:9px}
.historyRow{display:flex;gap:10px;align-items:center;font-size:12.5px;flex-wrap:wrap;border-left:var(--line-thick) solid var(--ink);padding-left:12px}
.historyWhen{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;min-width:180px;color:var(--ink-soft)}

/* policy playground (evidence passport) */
.policyForm{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;align-items:end;margin:14px 0 18px}
.policyField label{display:block;font-size:11px;font-weight:900;letter-spacing:.09em;text-transform:uppercase;color:var(--ink-soft);margin-bottom:6px}
.policyField select,.policyField input{width:100%;padding:10px 12px;border:var(--border);border-radius:10px;background:var(--paper);color:var(--ink);font-family:inherit;font-size:13.5px;font-weight:600}
.policyField--checkbox{display:flex;align-items:center}
.policyField--checkbox label{display:flex;gap:9px;align-items:center;font-size:12px;text-transform:none;letter-spacing:0;color:var(--ink);font-weight:700;margin:0}
.policyField input[type="checkbox"]{width:17px;height:17px;padding:0;accent-color:var(--ink)}
.policyResult{border:var(--line-thick) solid var(--ink);border-radius:var(--radius-md);padding:18px;background:var(--periwinkle)}
.policyResult--error{background:var(--paper-deep)}
.policyDecision{margin-bottom:10px}
.policyReasons{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:7px}
.policyReason{font-size:13px;font-weight:600;display:flex;gap:9px;align-items:baseline;flex-wrap:wrap}
.policyReason code{font-size:11px;background:var(--card);border:1px solid var(--ink);border-radius:4px;padding:1px 6px;font-weight:700}
.policyReasonsEmpty{font-size:13px;font-weight:600;margin:0}

/* ── 13. misc pages (source claim, notices) ────────────────────────────────── */
.stepList{counter-reset:step;padding:0;list-style:none;margin:22px 0 0;display:flex;flex-direction:column;gap:20px}
.stepList li{position:relative;padding-left:52px}
.stepList li::before{counter-increment:step;content:"0" counter(step);position:absolute;left:0;top:-2px;width:36px;height:36px;border:var(--border);border-radius:10px;background:var(--yellow);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900}
.stepList li strong{display:block;font-size:clamp(16px,1.8vw,20px);font-weight:900;letter-spacing:-.03em;margin-bottom:4px}
.stepList li p{font-size:13px;margin:0 0 10px}
.formGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}
.formGrid label{font-size:11px;font-weight:900;letter-spacing:.09em;text-transform:uppercase;color:var(--ink-soft);display:block;margin-bottom:6px}
.formGrid input{width:100%;padding:10px 12px;border:var(--border);border-radius:10px;background:var(--paper);color:var(--ink);font-family:inherit;font-size:13.5px;font-weight:600}
.repoList{display:flex;flex-direction:column;gap:9px;max-height:320px;overflow:auto;border:var(--border);border-radius:var(--radius-sm);padding:12px;background:var(--paper)}
.repoOption{font-size:13px;display:flex;gap:10px;align-items:center;font-weight:600;flex-wrap:wrap}
.repoNote{font-size:10px;font-weight:900;letter-spacing:.07em;text-transform:uppercase;border:1px solid var(--ink);border-radius:999px;padding:2px 8px;background:var(--tone-neutral)}
.repoNote--good{background:var(--cyan)}
.claimResult{border:var(--line-thick) solid var(--ink);border-radius:var(--radius-md);padding:18px;background:var(--periwinkle)}
.claimResult--error{background:var(--paper-deep)}
.claimPreview{border:var(--border);border-radius:var(--radius-sm);background:var(--paper);padding:12px;font-size:12px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;overflow:auto;max-height:240px;margin:0}
.demoBanner{border:var(--border);border-radius:var(--radius-sm);padding:11px 15px;font-size:13px;font-weight:700;margin:18px 0 0;background:var(--periwinkle)}
.upcoming{border:1px dashed var(--ink);border-radius:var(--radius-sm);background:transparent;padding:12px 16px;margin-top:24px}
.upcoming h2{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-soft);margin:0 0 6px}
.upcoming p{font-size:12.5px;margin:0}

/* ── 14. motion ───────────────────────────────────────────────────────────── */
@keyframes drift{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
.float{animation:drift 8s ease-in-out infinite}
.float--slow{animation:drift 11s ease-in-out infinite}
@media (prefers-reduced-motion: reduce){
  *{animation:none !important;transition:none !important}
  .button:hover,.resultCard:hover,.exampleChip:hover,.catChip:hover,.filterChip:hover{transform:none;box-shadow:none}
}

/* ── 15. responsive ────────────────────────────────────────────────────────
   Recomposed at each step rather than scaled: the rail becomes a compact top bar, the split tool
   layout becomes one column, and decorative objects that stop doing a job are dropped. */
@media (max-width:1100px){
  .heroPanel{grid-template-columns:minmax(0,1.6fr) minmax(0,.9fr)}
  .boundary{grid-template-columns:1fr}
  .boundaryArt{max-width:300px;justify-self:start}
}
@media (max-width:900px){
  .page{grid-template-columns:1fr}
  .rail{display:none}
  .topbar{
    display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;
    border-bottom:var(--line) solid var(--ink);background:var(--card);
    padding:10px clamp(14px,4vw,28px);position:sticky;top:0;z-index:20;
  }
  .topbarMark{display:flex;align-items:center;gap:9px;font-size:14px;font-weight:900;letter-spacing:-.03em}
  .topbarMark .brandMark{border-radius:9px}
  .topbarNav{display:flex;gap:6px;flex-wrap:wrap}
  .topbarNav a{border:var(--line) solid var(--ink);border-radius:999px;padding:5px 11px;font-size:11px;font-weight:900;letter-spacing:.05em;text-transform:uppercase;background:var(--paper)}
  .topbarNav a.active{background:var(--yellow)}
  .heroPanel{grid-template-columns:1fr;gap:20px}
  .heroArt{order:-1;max-width:240px;justify-self:start}
  .toolSplit{grid-template-columns:1fr}
  .passportHead{grid-template-columns:1fr}
  .passportStamp{width:92px}
  .libRow{grid-template-columns:56px minmax(0,1fr);gap:6px 16px}
  .libArt{width:56px;height:56px;border-radius:12px}
  .libActions{grid-column:2;justify-self:start;margin-top:4px}
}
@media (max-width:640px){
  .main{padding:20px 16px 0}
  .footer{padding:28px 16px 24px}
  .frame{padding:18px 16px;border-radius:var(--radius-md);border-width:var(--line)}
  h1{font-size:clamp(28px,8vw,38px);max-width:none}
  h1.hero{font-size:clamp(32px,9.5vw,44px);max-width:none}
  .fieldRow,.hashRow,.summaryRow{grid-template-columns:1fr;gap:4px;padding:8px 0}
  .searchForm{flex-direction:column;margin-top:16px}
  .searchForm input[type="search"]{width:100%}
  .searchForm .button{width:100%}
  .heroArt,.pageHeadArt{display:none} /* the drawings stop doing a compositional job at this width */
  .resultCard{grid-template-columns:1fr;padding:16px 14px 16px 20px}
  .cardStamp{display:none}
  .libRow{grid-template-columns:1fr;gap:10px;padding:18px 0}
  .libArt{width:52px;height:52px;border-radius:11px}
  .libActions{grid-column:1;justify-self:start}
  .libFacts{flex-direction:column;gap:6px}
  .historyWhen{min-width:0;width:100%}
  .stateKey{grid-template-columns:1fr}
  .stateKeyItem{border-right:0;border-bottom:var(--line) solid var(--ink)}
  .stateKeyItem:last-child{border-bottom:0}
  .tally{flex:1 1 calc(50% - 10px);min-width:0;padding:8px 12px}
  .tallyNum{font-size:22px}
  .endpoint{border-right:0}
  .codeCard pre{font-size:11px;padding:11px 12px}
  .modeSwitch{width:100%}
  .modeSwitch a{flex:1;text-align:center;padding:9px 10px;font-size:12.5px}
  .boundary{padding:16px 14px}
  .boundary::before{width:6px}
  .boundaryArt{display:none}
  .scanInput{min-height:240px}
}
`;

/**
 * The one shared illustration vocabulary for the whole product: an outlined **stamp** ring (the
 * seal AegisOne presses only when real evidence exists) and a **byte grid** (the bytes it actually
 * compares), plus a comparison arrow. Every illustration on every page is assembled from these —
 * no second metaphor, no raster/stock art, no external asset requests.
 */
const SPRITE = `<svg class="sprite" aria-hidden="true" focusable="false"><defs>
<symbol id="ic-stamp" viewBox="0 0 100 100">
  <path d="M50 4 66 12 84 10 88 27 100 40 92 56 96 74 79 81 70 96 53 92 37 99 26 86 8 82 8 64 0 48 10 33 8 15 27 13Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/>
  <circle cx="50" cy="52" r="29" fill="none" stroke="currentColor" stroke-width="4"/>
</symbol>
<symbol id="ic-bytegrid" viewBox="0 0 60 60">
  <rect x="3" y="3" width="16" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="3.5"/>
  <rect x="22" y="3" width="16" height="16" rx="3" fill="currentColor"/>
  <rect x="41" y="3" width="16" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="3.5"/>
  <rect x="3" y="22" width="16" height="16" rx="3" fill="currentColor"/>
  <rect x="22" y="22" width="16" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="3.5"/>
  <rect x="41" y="22" width="16" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="3.5"/>
  <rect x="3" y="41" width="16" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="3.5"/>
  <rect x="22" y="41" width="16" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="3.5"/>
  <rect x="41" y="41" width="16" height="16" rx="3" fill="currentColor"/>
</symbol>
<symbol id="ic-arrow" viewBox="0 0 24 24">
  <path d="M3 12h16M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
</symbol>
</defs></svg>`;

/**
 * The **brand mark** — the repo owner's real AegisOne logo file, served verbatim from this origin
 * at `/static/brand/logo.jpg` (`apps/web/src/static-assets.ts`). This is deliberately *not*
 * generated or reinterpreted here.
 *
 * Note the distinction the rest of the codebase depends on: the brand mark identifies the product
 * (nav + favicon, this function), while the stamp/byte-grid SVG vocabulary (`#ic-stamp`,
 * `#ic-bytegrid`) is *verdict illustration* for MATCH/MISMATCH/CLEAN/FLAGGED.
 */
export function brandLogoImg(size = 48): string {
  return `<span class="brandMark" style="--brand-size:${size}px"><img src="/static/brand/logo.jpg" width="${size}" height="${size}" alt="AegisOne" decoding="async"></span>`;
}

/**
 * The four-section information architecture. Primary navigation is exactly these four, and each
 * one has a single job that should be understandable in two seconds:
 *
 *   01 SKILLS      I find capabilities        the browsable, evidence-annotated catalog
 *   02 AUDIT       I check something          paste-to-audit and package verification
 *   03 VERIFIED    I inspect proof            the evidence registry
 *   04 FOR AGENTS  I connect my agent         MCP + REST integration docs
 *
 * `Claim` is deliberately not in primary navigation: authenticating a source claim is a
 * publisher-side task, not a first-visit action. `/source/claim` and every piece of M8.5
 * source-authentication code remain fully working and reachable by direct URL and from the footer.
 * `/proof` (the M1-M7 live 0G evidence ledger) likewise keeps a footer link.
 */
const NAV_ITEMS: ReadonlyArray<{ href: string; num: string; label: string; short: string; key: LayoutOptions["activeNav"] }> = [
  { href: "/", num: "01", label: "Skills", short: "Skills", key: "skills" },
  { href: "/audit", num: "02", label: "Audit", short: "Audit", key: "audit" },
  { href: "/verified", num: "03", label: "Verified", short: "Verified", key: "verified" },
  // Two words on two lines in a 78px rail reads better than one cramped 9px line.
  { href: "/agents", num: "04", label: "For<br>agents", short: "For agents", key: "agents" },
];

function railNav(active: LayoutOptions["activeNav"]): string {
  return NAV_ITEMS.map((item) => {
    const isActive = item.key !== "none" && item.key === active;
    return `<li><a href="${item.href}"${isActive ? ' class="active" aria-current="page"' : ""}><span class="railNum" aria-hidden="true">${item.num}</span><span class="railLabel">${item.label}</span></a></li>`;
  }).join("");
}

function topbarNav(active: LayoutOptions["activeNav"]): string {
  return NAV_ITEMS.map((item) => {
    const isActive = item.key !== "none" && item.key === active;
    return `<a href="${item.href}"${isActive ? ' class="active" aria-current="page"' : ""}>${item.short}</a>`;
  }).join("");
}

export function renderLayoutHtml(options: LayoutOptions): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#f7f5ef">
<meta name="color-scheme" content="light">
<title>${options.title}</title>
<link rel="icon" type="image/jpeg" href="/static/brand/logo.jpg">
<link rel="apple-touch-icon" href="/static/brand/logo.jpg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;700;900&display=swap">
<style>${STYLE}</style>
</head>
<body>
${SPRITE}
<a class="skiplink" href="#main">Skip to content</a>
<div class="page">
  <nav class="rail" aria-label="Primary">
    <a href="/" aria-label="AegisOne home">${brandLogoImg(48)}</a>
    <ul class="railNav">${railNav(options.activeNav)}</ul>
  </nav>
  <div class="col">
    <nav class="topbar" aria-label="Primary (compact)">
      <a class="topbarMark" href="/">${brandLogoImg(28)} AegisOne</a>
      <div class="topbarNav">${topbarNav(options.activeNav)}</div>
    </nav>
    <main class="main" id="main">
      ${options.bodyHtml}
    </main>
    <footer class="footer">
      <span>Discovery, source assurance, correspondence, security and policy are always shown as independent dimensions — never collapsed into one trust score.</span>
      <span class="footerLinks"><a href="/proof">0G evidence ledger</a> · <a href="/source/claim">Claim a source</a> · <a href="https://github.com/Ollie202/aegisone" rel="noopener noreferrer" target="_blank">public source</a></span>
    </footer>
  </div>
</div>
${options.scriptTag ?? ""}
</body>
</html>`;
}
