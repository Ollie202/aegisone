// Shared HTML shell for the AegisOne Hub.
//
// Visual language: "Playful Neo-Brutalist" (ADR-015, superseding ADR-013's *visual-direction*
// section only — ADR-013's technology decision, vanilla JS + no framework + no build step +
// isomorphic SSR/client `.mjs` render modules, is unchanged and still in force).
//
// The single *illustration* metaphor for the whole product is the **stamp**: a heavy-outlined,
// off-axis seal that gets pressed onto something once evidence exists, plus the "byte grid" of small
// outlined squares that stands for the bytes AegisOne actually compares. Every illustration on
// every page is built from that one shape family (stamp ring + byte grid + a comparison arrow),
// per the design skill's Design Restraint Rules ("pick one metaphor, reuse it").
//
// That family is *extended*, not replaced, by `#ic-cube` (an outlined package — the unit of thing
// being indexed), `#ic-zig` (a chunky comparison arrow) and `#ic-lens` (the inspection itself).
// These are the same flat-outlined geometry at the same stroke weights and exist so the hero can
// be a scattered cluster at several depths rather than one tidy corner motif. There is still
// exactly one metaphor.
//
// Composition (design skill §3, §9, §15): the page is not a tidy card on an off-white ground. A
// large flat yellow zone cuts diagonally across the upper-left of the viewport (`body::before`)
// against a pale lavender ground, the hero carries its own share of that same field
// (`.hero::before`) so the colour reads as ONE zone continuing through the frame's outlined
// boundary, and two to five decorative objects (`escapeObjectsHtml`) are translated out past that
// boundary into the page gutter. All of it is behind content, `pointer-events:none`, `aria-hidden`,
// and removed below 960px.
//
// The **brand mark is a separate thing** and is NOT drawn here: it is the repo owner's real logo
// file, `apps/web/public/brand/logo.jpg`, served at `/static/brand/logo.jpg` (see `brandLogoImg`
// below and ADR-015's addendum). Verdict illustration must never be mistaken for brand identity.
//
// Trust-state colour mapping (documented in ADR-015). Colour NEVER carries a verdict on its own —
// `badges.mjs` always pairs a glyph AND a text label with every state; this palette only makes the
// already-textual state faster to scan:
//   cyan      #22DCEB  affirmative / proven      MATCH, REPOSITORY_AUTHENTICATED, SIGNED_RELEASE, ALLOW, CLEAN
//   lavender  #B79CFF  discovery-only / info     INDEXED, canonical evidence AVAILABLE
//   amber     #F5A524  caution / needs review    DECLARED, DIVERGED, STALE, INSUFFICIENT_EVIDENCE, REVIEW, FLAGGED
//   alarm     #FF4A3D  negative                  MISMATCH, DENY, BLACKLISTED, integrity failure
//   paper/ink          neutral / absent          NONE, NOT_EVALUATED, AUDIT NOT RUN
// Brand yellow #FFD91A is deliberately reserved for *chrome* (primary CTA, hero colour field) and
// is never used as a trust state, so "the yellow thing" never reads as a verdict.

export interface LayoutOptions {
  title: string;
  activeNav: "skills" | "audit" | "verified" | "agents" | "resource" | "source-claim" | "none";
  bodyHtml: string;
  /** A raw <script> tag (already trusted, authored by this codebase) appended before </body>. */
  scriptTag?: string;
}

const STYLE = `
:root{
  --ink:#0a0a0a; --ink-soft:#3d3a34;
  --paper:#f7f5ef; --paper-deep:#efece2; --card:#fffdf7;
  /* The page ground is a pale lavender-blue, not off-white: the composition needs a cool ground
     for the warm yellow structural field to cut across (design skill §3 — "colour should separate
     major visual zones"). Both are pale enough that ink text keeps >12:1 contrast on either. */
  --ground:#e8ebfa; --ground-dot:#d3d9f2;
  --yellow:#ffd91a; --lavender:#b79cff; --cyan:#22dceb; --periwinkle:#d8e1ff;
  --amber:#f5a524; --alarm:#ff4a3d;
  --tone-neutral:#e6e2d6; --tone-info:var(--lavender); --tone-positive:var(--cyan);
  --tone-caution:var(--amber); --tone-negative:var(--alarm);
  --line:2px; --line-thick:3px;
  --border:var(--line) solid var(--ink);
  --radius-lg:32px; --radius-md:20px; --radius-sm:12px;
  --hard-shadow:6px 6px 0 var(--ink);
  --hard-shadow-sm:4px 4px 0 var(--ink);
  --rail:96px;
  font-family:"Archivo","Helvetica Neue",Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;
  color-scheme:light;
}
*{box-sizing:border-box}
body{
  margin:0;background:var(--ground);color:var(--ink);line-height:1.5;
  -webkit-font-smoothing:antialiased;
  background-image:radial-gradient(var(--ground-dot) 1.4px, transparent 1.4px);
  background-size:22px 22px;
  position:relative;
  /* Decorative objects are deliberately translated outside their containers below. overflow-x:clip
     (not hidden) keeps them from producing a sideways scrollbar without turning body into a scroll
     container, which would break the sticky nav rail. */
  overflow-x:clip;
}
/* ---------- the structural colour field ----------
   One large flat yellow zone cutting diagonally across the upper-left of the viewport, meeting the
   pale lavender ground (design skill §3: "prefer large flat colour fields", "colour should separate
   major visual zones, not decorate every element"). It is a fixed, pointer-transparent, z-index:-1
   layer, so it can never sit above text, intercept a click, or change any foreground contrast — all
   copy still renders on --card / --paper / the hero's own field, never directly on this. */
body::before{
  content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;
  background:var(--yellow);
  clip-path:polygon(0 0, 62vw 0, 0 78vh);
}
/* A second, smaller counterweight field in the lower right keeps the composition asymmetric rather
   than merely diagonal — one dense corner, one sparse corner (design skill §9). */
body::after{
  content:"";position:fixed;right:0;bottom:0;width:34vw;height:40vh;z-index:-1;pointer-events:none;
  background:var(--periwinkle);
  clip-path:polygon(100% 24%, 100% 100%, 8% 100%);
}
a{color:var(--ink);text-decoration:none;text-underline-offset:3px}
a:hover{text-decoration:underline}
.sprite{position:absolute;width:0;height:0;overflow:hidden}
.skiplink{position:absolute;left:-9999px;top:0;background:var(--yellow);border:var(--border);padding:10px 16px;font-weight:800;z-index:99}
.skiplink:focus{left:12px;top:12px}
:focus-visible{outline:3px solid var(--ink);outline-offset:3px}

/* ---------- page shell: slim vertical rail + one big outlined frame ---------- */
/* The side padding is a deliberate *gutter*, not decoration: the escaping decorative objects below
   (.escape--*) are translated into it, so it must stay wide enough for them to clear the frame's
   outlined boundary. The top padding is kept small — vertical space above the fold is spent on the
   search box and the catalog, not on chrome. */
.page{display:grid;grid-template-columns:var(--rail) minmax(0,1fr);gap:0;min-height:100vh;padding:26px 34px 0}
.rail{position:sticky;top:26px;align-self:start;height:calc(100vh - 52px);display:flex;flex-direction:column;justify-content:space-between;align-items:center;padding:0 8px 18px 0}
/* The real logo file sits in one outlined light frame so its own white ground reads as an
   intentional graphic frame rather than a broken image box on the dotted paper background. */
.brandMark{display:inline-grid;place-items:center;width:var(--brand-size,56px);height:var(--brand-size,56px);border:var(--border);border-radius:14px;background:#fff;overflow:hidden;flex:none;transition:transform 180ms ease, box-shadow 180ms ease}
.brandMark img{display:block;width:100%;height:100%;object-fit:contain}
a:hover .brandMark{transform:translate(-2px,-2px);box-shadow:var(--hard-shadow-sm)}
.railNav{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:14px;align-items:center}
.railNav a{display:flex;flex-direction:column;align-items:center;gap:2px;font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-soft)}
.railNum{display:grid;place-items:center;width:34px;height:34px;border:var(--border);border-radius:10px;background:var(--card);font-size:12px;font-weight:900}
.railNav a:hover{text-decoration:none;color:var(--ink)}
.railNav a:hover .railNum{transform:translate(-2px,-2px);box-shadow:var(--hard-shadow-sm)}
.railNav a.active .railNum{background:var(--yellow);box-shadow:var(--hard-shadow-sm);transform:translate(-2px,-2px)}
.railNav a.active{color:var(--ink)}
.railNum{transition:transform 180ms ease, box-shadow 180ms ease}
.railEdge{writing-mode:vertical-rl;transform:rotate(180deg);font-size:10px;font-weight:800;letter-spacing:.22em;text-transform:uppercase;color:var(--ink-soft);white-space:nowrap}
.frame{border:var(--line-thick) solid var(--ink);border-radius:var(--radius-lg);background:var(--card);padding:clamp(20px,2.6vw,38px);margin-bottom:26px;position:relative}
.topbar{display:none}

/* ---------- editorial typography ---------- */
h1,h2,h3{margin:0;letter-spacing:-.04em;font-weight:900}
/* The hero previously ran to 92px at 7vw, which pushed the search box and the catalog below the
   fold on a laptop — the headline became the page instead of introducing it. Still editorial and
   still the largest thing on screen, just no longer the only thing. */
h1{font-size:clamp(30px,4.4vw,56px);line-height:1;margin:0 0 14px;max-width:20ch}
h1.tight{max-width:24ch}
h2{font-size:clamp(20px,2.4vw,30px);line-height:1.02;margin:0 0 14px}
h3{font-size:clamp(17px,1.6vw,21px);line-height:1.06}
p{color:var(--ink-soft);max-width:62ch}
.lede{font-size:clamp(15px,1.5vw,18px);color:var(--ink);font-weight:500}
.mark{background:var(--cyan);border:var(--border);border-radius:8px;padding:0 .18em;display:inline-block;transform:rotate(-1.2deg)}
.mark--yellow{background:var(--yellow)}
.eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:11px;font-weight:900;letter-spacing:.2em;text-transform:uppercase;color:var(--ink-soft)}
.edgeLabel{position:absolute;top:-13px;left:26px;background:var(--ink);color:var(--paper);font-size:10px;font-weight:900;letter-spacing:.2em;text-transform:uppercase;padding:4px 10px;border-radius:6px}
.edgeLabel--right{left:auto;right:26px}
.sectionNum{position:absolute;top:-16px;right:22px;width:34px;height:34px;border:var(--border);border-radius:50%;background:var(--yellow);display:grid;place-items:center;font-size:12px;font-weight:900;transform:rotate(6deg)}

/* ---------- primitives: pills, buttons, frames, stickers ---------- */
.pill{display:inline-flex;align-items:center;gap:6px;border:var(--border);border-radius:999px;padding:5px 12px;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;background:var(--card)}
.pill--yellow{background:var(--yellow)}
.pill--peri{background:var(--periwinkle)}
/* Varied pill treatments (design skill §7 chips: "small pill, dark outline, icon or coloured
   miniature square"). A row of identical chips reads as a filter bar; a solid / accent / outlined
   trio reads as composition. Each keeps its full ink outline and its own glyph, so the variation is
   never the only thing distinguishing one from another.
   Contrast: --paper #f7f5ef on --ink #0a0a0a ≈ 18.7:1; --ink on --cyan #22dceb ≈ 14.4:1; --ink on
   transparent-over-yellow ≈ 14.6:1. All far past WCAG AA for small bold text. */
.pill--ink{background:var(--ink);color:var(--paper);border-color:var(--ink)}
.pill--cyan{background:var(--cyan)}
.pill--outline{background:transparent}
.pill__glyph{font-size:11px;line-height:1;flex:none}
/* Accent typography (design skill §4 "a single word may use an outlined pill treatment"). Used
   EXACTLY once per page, on one word of the headline, so the headline itself becomes a graphic
   object without turning every word into a gimmick. */
.capsule{display:inline-block;background:var(--lavender);border:var(--line-thick) solid var(--ink);border-radius:999px;padding:0 .3em;transform:rotate(-1.6deg);line-height:.94}
.pillRow{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 18px}
.button{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:12px 22px;border:var(--border);border-radius:999px;background:var(--card);color:var(--ink);font-weight:800;font-size:14px;letter-spacing:-.01em;cursor:pointer;font-family:inherit;transition:transform 160ms ease, box-shadow 160ms ease}
.button:hover{text-decoration:none;transform:translate(-2px,-2px);box-shadow:var(--hard-shadow-sm)}
.button:active{transform:translate(1px,1px);box-shadow:none}
.button--primary{background:var(--yellow)}
.button[disabled]{opacity:.45;cursor:not-allowed}
.button[disabled]:hover{transform:none;box-shadow:none}
.button .arrow{transition:transform 160ms ease}
.button:hover .arrow{transform:translateX(3px)}
.ctaRow{display:flex;flex-wrap:wrap;gap:12px;align-items:center}
.panel{border:var(--border);border-radius:var(--radius-md);background:var(--card);padding:22px;position:relative}
.panel--flat{background:var(--paper)}
.sticker{position:absolute;border:var(--border);border-radius:12px;background:var(--card);padding:8px 12px;font-size:11px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;box-shadow:var(--hard-shadow-sm)}
.hatch{background-image:repeating-linear-gradient(45deg,var(--ink) 0 2px,transparent 2px 8px);opacity:.28}

/* ---------- badges (state chips) — see badges.mjs: never colour alone ---------- */
.badge{display:inline-flex;align-items:center;gap:6px;border:var(--border);border-radius:999px;padding:4px 11px;font-size:11px;font-weight:900;letter-spacing:.05em;text-transform:uppercase;background:var(--tone-neutral);color:var(--ink);white-space:nowrap}
.badge--neutral{background:var(--tone-neutral)}
.badge--positive{background:var(--tone-positive)}
.badge--negative{background:var(--tone-negative)}
.badge--caution{background:var(--tone-caution)}
.badge--info{background:var(--tone-info)}
.badge__glyph{font-size:11px;line-height:1}

/* ---------- hero ---------- */
.hero{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr);gap:clamp(20px,3vw,48px);align-items:end;position:relative}
/* The hero's own share of the page colour field. It bleeds out to the frame's inner border on the
   top and left (negative offsets exactly cancel .frame's padding) and is cut on the same diagonal
   as body::before, so the yellow reads as ONE zone continuing through the frame boundary rather
   than as a rectangle painted inside a card. Radius matches the frame's top-left corner.
   z-index:0 against .heroCopy's z-index:2 — it is always behind text, and it is flat ink-on-yellow
   underneath, so contrast only ever improves. */
.hero::before{
  content:"";position:absolute;z-index:0;pointer-events:none;
  top:calc(-1 * clamp(20px,2.6vw,38px));left:calc(-1 * clamp(20px,2.6vw,38px));
  width:min(760px,86%);height:calc(100% + clamp(20px,2.6vw,38px));
  background:var(--hero-field,var(--yellow));
  border-radius:calc(var(--radius-lg) - 3px) 0 0 0;
  clip-path:polygon(0 0, 100% 0, 62% 100%, 0 100%);
}
.hero--noField::before{display:none}
/* VERIFIED has no hero illustration — its dominant object is the state key below the fold. It
   still carries the colour field and the escaping objects, so the four sections read as one
   composition rather than one designed page and three plain ones. */
.hero--solo{grid-template-columns:minmax(0,1fr)}
.heroArt{position:relative;z-index:1;justify-self:center;align-self:center;width:100%;max-width:330px}
.heroArt svg{width:100%;height:auto;display:block;overflow:visible}
.heroCopy{position:relative;z-index:2}
/* The search input sits on the yellow field, so it keeps an opaque card fill and a full ink
   outline rather than the paper fill it had on a plain background. */
.hero .searchForm input[type="search"]{background:var(--card)}

/* ---------- escaping objects (design skill §9 controlled anti-grid) ----------
   Decorative SVG objects positioned against .frame and translated PAST its boundary. They are
   aria-hidden, pointer-events:none, sit at z-index 0/-? behind interactive content, and are removed
   entirely below 960px. Each one is placed in a margin or empty region — never over a control. */
.escape{position:absolute;pointer-events:none;z-index:1;display:block}
.escapeInner{display:block}
.escape svg{width:100%;height:auto;display:block;overflow:visible}
/* near: large, high-contrast, straddling the frame edge */
.escape--near{width:clamp(84px,7vw,116px)}
/* far: small, further out, reads as depth */
.escape--far{width:clamp(46px,3.6vw,62px);opacity:.9}
/* Offsets are measured from .hero, which is inset by .frame's padding (max 38px) plus its 3px
   border. Anything past ~41px therefore genuinely crosses the frame's outlined boundary and lands
   in the page gutter, which .page's 34px desktop side padding reserves for exactly this. */
.escape--tl{top:-58px;left:-62px;transform:rotate(-6deg)}
.escape--tr{top:-52px;right:64px;transform:rotate(5deg)}
.escape--rt{top:34%;right:-68px;transform:rotate(-4deg)}
.escape--bl{bottom:-54px;left:-50px;transform:rotate(4deg)}
.escape--br{bottom:-44px;right:-44px;transform:rotate(-5deg)}
.searchForm{display:flex;gap:12px;margin:22px 0 10px;max-width:640px}
.searchForm input[type="search"]{flex:1;min-width:0;padding:15px 20px;border:var(--border);border-radius:999px;font-size:16px;font-family:inherit;background:var(--paper);color:var(--ink);font-weight:600}
.searchForm input[type="search"]::placeholder{color:var(--ink-soft);font-weight:500}
.searchHint{font-size:14px;max-width:60ch}
/* Example *queries*, not example results: clicking one runs a real search against the real
   backend. They are the hero's category pills, so the page never ships pre-populated fixture rows
   that could read as live output. */
.exampleChip{font-family:inherit;cursor:pointer;text-transform:none;letter-spacing:0;font-size:12px;transition:transform 160ms ease, box-shadow 160ms ease}
.exampleChip:hover{transform:translate(-2px,-2px);box-shadow:var(--hard-shadow-sm)}
.federationRow{display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:13px;color:var(--ink-soft);margin-bottom:16px}
.federationRow label{display:inline-flex;gap:8px;align-items:center;font-weight:600}
.federationRow input[type="checkbox"]{width:17px;height:17px;accent-color:var(--ink)}

/* ---------- search results: editorial list, NOT a 3-column card grid ---------- */
.resultList{display:flex;flex-direction:column;gap:0;border-top:var(--line-thick) solid var(--ink);margin-top:8px}
.resultCard{position:relative;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px 22px;padding:22px 22px 22px 26px;border-bottom:var(--line) solid var(--ink);background:var(--card);transition:background 180ms ease, transform 180ms ease}
.resultCard:hover{background:var(--periwinkle);transform:translateX(3px)}
.resultCard::before{content:"";position:absolute;left:0;top:0;bottom:0;width:8px;background:var(--cyan)}
.resultCard--discoveryOnly::before{background-image:repeating-linear-gradient(45deg,var(--ink) 0 2px,transparent 2px 7px);background-color:var(--paper-deep)}
.cardHead{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}
.cardHead h3{margin:0;letter-spacing:-.03em}
.kindTag{font-size:10px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;border:var(--line) solid var(--ink);border-radius:6px;padding:2px 7px;white-space:nowrap;background:var(--paper)}
.cardDescription{font-size:14px;margin:8px 0 0;max-width:70ch}
.cardBadges{display:flex;flex-wrap:wrap;gap:7px;margin:12px 0 0;grid-column:1 / -1}
.cardNote{font-size:12px;font-weight:700;color:var(--ink-soft);align-self:center}
.cardMeta{display:flex;gap:12px;flex-wrap:wrap;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-soft);grid-column:1 / -1;margin-top:10px}
.relevance{border:var(--line) dashed var(--ink);border-radius:999px;padding:2px 9px;background:var(--paper)}
.cardUrl{grid-column:1 / -1;margin-top:8px;font-size:12px;word-break:break-all;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.cardStamp{align-self:start;width:54px;height:54px;flex:none}
.cardStamp svg{width:100%;height:100%;display:block}
.providerStatusList{list-style:none;padding:0;margin:0 0 16px;display:flex;flex-wrap:wrap;gap:8px}
.providerStatus{font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;border:var(--border);border-radius:999px;padding:5px 11px;background:var(--card)}
.providerStatus--ok{background:var(--periwinkle)}
.providerStatus--down{background:var(--amber)}
.emptyState{font-size:14px;font-weight:600;color:var(--ink-soft);border:var(--line) dashed var(--ink);border-radius:var(--radius-sm);padding:16px;background:var(--paper)}

/* ---------- evidence passport: one composition, not twenty cards ---------- */
.passportHead{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:24px;align-items:start;margin-bottom:30px}
.passportStamp{width:clamp(96px,13vw,150px);height:auto;flex:none;transform:rotate(-7deg)}
.passportStamp svg{width:100%;height:auto;display:block}
/* The verdict summary: the whole record in one 2-second read. Every row is a real dimension label
   plus the backend's own state — never a single collapsed trust score. */
.evidenceSummary{border:var(--line-thick) solid var(--ink);border-radius:var(--radius-md);background:var(--card);padding:20px clamp(16px,2.2vw,26px);margin-bottom:22px}
.summaryRows{display:grid;gap:0;margin:0}
.summaryRow{display:grid;grid-template-columns:190px minmax(0,1fr);gap:14px;align-items:center;padding:9px 0;border-bottom:1px dotted rgba(10,10,10,.18)}
.summaryRow:last-child{border-bottom:0}
.summaryLabel{font-size:11px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-soft)}
.summaryValue{display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-size:13.5px;font-weight:700}
.summaryNote{font-size:12.5px;margin:14px 0 0;font-weight:600}

.passportRun{display:grid;gap:0;border:var(--line-thick) solid var(--ink);border-radius:var(--radius-md);overflow:visible;background:var(--card)}
/* Detail is genuinely secondary: each dimension is a native <details> disclosure, collapsed by
   default, so the summary above is what competes for attention. No JavaScript is involved. */
.passportSection{position:relative;border-bottom:var(--line) solid var(--ink)}
.passportSection:last-child{border-bottom:0}
.passportSection:nth-child(even){background:var(--paper)}
.passportSection > *:not(summary){margin-left:clamp(16px,2.4vw,30px);margin-right:clamp(16px,2.4vw,30px)}
.passportSection > *:last-child{margin-bottom:22px}
.passportSection h2{font-size:clamp(17px,1.7vw,21px);margin:0}
.sectionMark{display:flex;align-items:center;gap:12px;padding:16px clamp(16px,2.4vw,30px);cursor:pointer;list-style:none;user-select:none}
.sectionMark::-webkit-details-marker{display:none}
.sectionMark:hover{background:var(--periwinkle)}
.sectionMark .idx{width:30px;height:30px;flex:none;border:var(--border);border-radius:9px;display:grid;place-items:center;font-size:12px;font-weight:900;background:var(--card)}
.sectionMark .disclose{margin-left:auto;font-size:11px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-soft);white-space:nowrap}
.passportSection[open] .sectionMark .disclose::after{content:"– hide"}
.passportSection:not([open]) .sectionMark .disclose::after{content:"+ detail"}
.fieldRow{display:grid;grid-template-columns:230px minmax(0,1fr);gap:14px;padding:7px 0;font-size:14px;align-items:baseline;border-bottom:1px dotted rgba(10,10,10,.18)}
.fieldRow:last-of-type{border-bottom:0}
.fieldLabel{font-size:11px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-soft)}
.fieldValue{font-weight:600;word-break:break-word}
.hashRow{display:grid;grid-template-columns:230px minmax(0,1fr);gap:14px;padding:7px 0;align-items:baseline;border-bottom:1px dotted rgba(10,10,10,.18)}
.hashLabel{font-size:11px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-soft)}
.hashValue{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;word-break:break-all;background:var(--paper-deep);border:1px solid var(--ink);border-radius:6px;padding:2px 7px}
.hashValue--empty{background:transparent;border-style:dashed;color:var(--ink-soft)}
.passportDescription,.passportNote{font-size:13.5px;margin:12px 0 0}
.passportWarning{font-size:13.5px;margin:14px 0 0;border-left:var(--line-thick) solid var(--amber);background:var(--paper-deep);padding:10px 14px;border-radius:0 10px 10px 0;color:var(--ink);font-weight:600}
.integrityWarning{font-size:13.5px;margin:14px 0 0;border-left:var(--line-thick) solid var(--alarm);background:var(--paper-deep);padding:10px 14px;border-radius:0 10px 10px 0;color:var(--ink);font-weight:700}
.findingList{font-size:13.5px;padding-left:20px;margin:12px 0 0}
.findingList li{margin-bottom:6px}
.historyList{list-style:none;padding:0;margin:12px 0 0;display:flex;flex-direction:column;gap:10px}
.historyRow{display:flex;gap:10px;align-items:center;font-size:13px;flex-wrap:wrap;border-left:var(--line-thick) solid var(--ink);padding-left:12px}
.historyWhen{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;min-width:190px;color:var(--ink-soft)}

/* ---------- policy playground ---------- */
.policyForm{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:16px;align-items:end;margin:16px 0 20px}
.policyField label{display:block;font-size:11px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-soft);margin-bottom:7px}
.policyField select,.policyField input{width:100%;padding:11px 13px;border:var(--border);border-radius:12px;background:var(--paper);color:var(--ink);font-family:inherit;font-size:14px;font-weight:600}
.policyField--checkbox{display:flex;align-items:center}
.policyField--checkbox label{display:flex;gap:9px;align-items:center;font-size:12px;text-transform:none;letter-spacing:0;color:var(--ink);font-weight:700;margin:0}
.policyField input[type="checkbox"]{width:18px;height:18px;padding:0;accent-color:var(--ink)}
.policyResult{border:var(--line-thick) solid var(--ink);border-radius:var(--radius-md);padding:20px;background:var(--periwinkle)}
.policyResult--error{background:var(--paper-deep)}
.policyDecision{margin-bottom:12px}
.policyReasons{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:8px}
.policyReason{font-size:13.5px;font-weight:600;display:flex;gap:9px;align-items:baseline;flex-wrap:wrap}
.policyReason code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;background:var(--card);border:1px solid var(--ink);border-radius:5px;padding:1px 6px;font-weight:700}
.policyReasonsEmpty{font-size:13.5px;font-weight:600;margin:0}
.errorText{color:var(--ink);font-weight:800;border-left:var(--line-thick) solid var(--alarm);padding-left:12px}

/* ---------- scan page ---------- */
.scanGrid{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr);gap:clamp(20px,3vw,40px);align-items:start}
.scanInput{width:100%;min-height:300px;padding:16px 18px;border:var(--line-thick) solid var(--ink);border-radius:var(--radius-md);background:var(--paper);color:var(--ink);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;line-height:1.55;resize:vertical}
.scanControls{display:flex;flex-wrap:wrap;gap:14px;align-items:center;margin-top:16px}
.scanOption{display:flex;gap:10px;align-items:flex-start;border:var(--border);border-radius:var(--radius-sm);padding:11px 14px;background:var(--paper);max-width:44ch}
.scanOption input[type="checkbox"]{width:18px;height:18px;margin-top:2px;flex:none;accent-color:var(--ink)}
.scanOption span{font-size:12.5px;font-weight:600;color:var(--ink)}
.scanOption strong{display:block;font-size:12px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;margin-bottom:2px}
.verdictStamp{display:grid;place-items:center;width:clamp(140px,20vw,200px);height:auto;margin:0 auto 4px;transform:rotate(-6deg)}
.verdictStamp svg{width:100%;height:auto;display:block}
.verdictPanel{border:var(--line-thick) solid var(--ink);border-radius:var(--radius-md);padding:24px;background:var(--card);text-align:center}
.verdictPanel--CLEAN{background:var(--cyan)}
.verdictPanel--FLAGGED{background:var(--amber)}
.verdictPanel--BLACKLISTED{background:var(--alarm)}
.verdictWord{font-size:clamp(28px,4.4vw,52px);font-weight:900;letter-spacing:-.05em;line-height:1;margin:10px 0 6px}
.verdictMeaning{font-size:13.5px;font-weight:700;color:var(--ink);margin:0 auto;max-width:44ch}
.scanMetaRow{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:16px}
.advisoryPanel{border:var(--line) dashed var(--ink);border-radius:var(--radius-md);padding:18px;background:var(--paper);margin-top:18px}
.advisoryPanel h3{font-size:15px;margin-bottom:6px}
.advisoryStamp{font-size:11px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;border:var(--line) dashed var(--ink);border-radius:999px;padding:4px 11px;display:inline-block;background:var(--card)}
.advisoryBody{font-size:13.5px;font-weight:600;margin:10px 0 0;white-space:pre-wrap;word-break:break-word}
.findingRow{display:grid;grid-template-columns:auto minmax(0,1fr);gap:12px;align-items:start;padding:13px 0;border-bottom:var(--line) solid var(--ink)}
.findingRow:last-child{border-bottom:0}
.findingRule{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:var(--ink-soft);word-break:break-all}
.findingWhere{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;color:var(--ink-soft);word-break:break-all}
.findingEvidence{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;background:var(--paper-deep);border:1px solid var(--ink);border-radius:6px;padding:6px 9px;margin-top:7px;word-break:break-all;white-space:pre-wrap;max-height:9em;overflow:auto}
.findingPlainEnglish{font-size:13.5px;margin:8px 0 0;line-height:1.5}
.findingConsequence{color:var(--ink-soft)}
.findingEvidenceNote{font-size:11.5px;color:var(--ink-soft);margin:8px 0 0;font-style:italic}
.fileList{list-style:none;margin:8px 0 0;padding:0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;display:flex;flex-direction:column;gap:4px}
.notProven{border-left:var(--line-thick) solid var(--alarm)}
.notProvenList{margin:12px 0 0;padding-left:20px;font-size:13.5px;line-height:1.55;display:flex;flex-direction:column;gap:8px}
.auditTypeGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin-top:16px}
.verifyTargets{display:flex;flex-direction:column;gap:10px;margin:16px 0}
.verifyTarget{display:flex;gap:12px;align-items:flex-start;border:var(--line) solid var(--ink);border-radius:12px;padding:12px 14px;cursor:pointer;background:var(--card)}
.verifyTarget:hover{background:var(--paper)}
.verifyTargetBody{display:flex;flex-direction:column;gap:4px;min-width:0}
.verifyTargetMeta{font-size:12.5px;opacity:.75;word-break:break-word}
.verifyPanel h3{margin:18px 0 6px;font-size:14px;letter-spacing:.02em;text-transform:uppercase}
.auditTypeCard{border:var(--border);border-radius:var(--radius-sm);padding:16px;background:var(--card);position:relative}
.auditTypeCard--live{box-shadow:var(--hard-shadow-sm);background:var(--card)}
.auditTypeCard--upcoming{opacity:.86;background:var(--paper-deep);border-style:dashed}
.auditTypeCard h3{margin:10px 0 6px;font-size:15px}
.auditTypeCard p{margin:0 0 6px;font-size:13px;line-height:1.5}
.auditTypeCard .passportNote{margin-top:6px}

/* ---------- source claim ---------- */
.stepList{counter-reset:step;padding:0;list-style:none;margin:26px 0 0;display:flex;flex-direction:column;gap:22px}
.stepList li{position:relative;padding-left:60px}
.stepList li::before{counter-increment:step;content:"0" counter(step);position:absolute;left:0;top:-2px;width:42px;height:42px;border:var(--border);border-radius:12px;background:var(--yellow);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;transform:rotate(-4deg)}
.stepList li strong{display:block;font-size:clamp(17px,2vw,22px);font-weight:900;letter-spacing:-.03em;margin-bottom:4px}
.stepList li p{font-size:13.5px;margin:0 0 12px}
.formGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:16px}
.formGrid label{font-size:11px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-soft);display:block;margin-bottom:7px}
.formGrid input{width:100%;padding:11px 13px;border:var(--border);border-radius:12px;background:var(--paper);color:var(--ink);font-family:inherit;font-size:14px;font-weight:600}
.repoList{display:flex;flex-direction:column;gap:10px;max-height:340px;overflow:auto;border:var(--border);border-radius:var(--radius-sm);padding:14px;background:var(--paper)}
.repoOption{font-size:13.5px;display:flex;gap:10px;align-items:center;font-weight:600;flex-wrap:wrap}
.repoNote{font-size:10px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;border:var(--line) solid var(--ink);border-radius:999px;padding:2px 8px;background:var(--tone-neutral)}
.repoNote--good{background:var(--cyan)}
.claimResult{border:var(--line-thick) solid var(--ink);border-radius:var(--radius-md);padding:20px;background:var(--periwinkle)}
.claimResult--error{background:var(--paper-deep)}
.claimPreview{border:var(--border);border-radius:var(--radius-sm);background:var(--paper);padding:14px;font-size:12px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;overflow:auto;max-height:260px;margin:0}

/* ---------- skill library: an editorial numbered list, deliberately NOT a card grid ----------
   Design skill §17 explicitly rejects "endless three-column feature cards" and §16 requires one
   dominant element per viewport. So: rule-separated editorial rows, one featured lead entry with a
   flat colour field, oversized outlined index numerals, and a rotated illustration tile per row. */
.catRail{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 22px;padding-bottom:18px;border-bottom:var(--line-thick) solid var(--ink)}
.catChip{font-family:inherit;cursor:pointer;text-transform:none;letter-spacing:0;font-size:12px;display:inline-flex;gap:7px;align-items:center;transition:transform 160ms ease, box-shadow 160ms ease}
.catChip:hover:not([disabled]){transform:translate(-2px,-2px);box-shadow:var(--hard-shadow-sm)}
.catChip--active{background:var(--yellow);box-shadow:var(--hard-shadow-sm);transform:translate(-2px,-2px)}
.catChip--empty,.catChip[disabled]{opacity:.4;cursor:not-allowed}
.catCount{font-size:10px;font-weight:900;border:var(--line) solid var(--ink);border-radius:999px;padding:0 6px;background:var(--paper)}
.catChip--active .catCount{background:var(--card)}

.library{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:0}
.libRow{position:relative;display:grid;grid-template-columns:auto 96px minmax(0,1fr);gap:6px 22px;align-items:start;padding:26px 4px;border-bottom:var(--line) solid var(--ink)}
.libRow:last-child{border-bottom:0}
.libRow[hidden]{display:none}
.libIndex{font-size:clamp(26px,3.4vw,44px);font-weight:900;letter-spacing:-.06em;line-height:1;color:var(--ink);opacity:.22;transform:rotate(-6deg);align-self:start;min-width:2ch}
.libArt{display:block;width:96px;height:96px;border:var(--border);border-radius:18px;background:var(--paper);padding:6px;transform:rotate(-4deg);transition:transform 200ms ease}
.libArt svg{width:100%;height:100%;display:block;overflow:visible}
.libRow:hover .libArt{transform:rotate(2deg) translateY(-3px)}
.libBody{min-width:0}
.libHead{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin-bottom:8px}
.libHead h3{margin:0;font-size:clamp(19px,2.1vw,27px);letter-spacing:-.035em}
.libDesc{font-size:14px;margin:0 0 12px;max-width:68ch}
.libMeta{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:12px}
.pill--cat{background:var(--periwinkle)}
.libBy{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-soft)}
.libBy--unknown{border:var(--line) dashed var(--ink);border-radius:999px;padding:2px 9px}
.libDims{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:14px}
.libFacts{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:6px 20px;margin:0 0 12px}
.libFact{display:flex;flex-direction:column;gap:3px;border-top:1px dotted rgba(10,10,10,.24);padding-top:6px}
.libFact dt{font-size:10px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-soft)}
.libFact dd{margin:0}
.libFactValue{font-size:13px;font-weight:700}
.libFactValue--mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;background:var(--paper-deep);border:1px solid var(--ink);border-radius:6px;padding:1px 6px;display:inline-block}
/* "unknown" is a real rendered word, never an empty cell — a blank would read as "fine". */
.libFactValue--unknown{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--ink-soft);border:1px dashed var(--ink);border-radius:6px;padding:1px 7px;display:inline-block}
.libUrl{font-size:12px;word-break:break-all;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;margin-bottom:12px}
.libActions{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.libCta{font-size:13px;padding:9px 18px}
.libCta--none{font-size:12px;font-weight:700;color:var(--ink-soft);border:var(--line) dashed var(--ink);border-radius:999px;padding:6px 13px}
/* The single dominant entry: flat colour field, thicker ink, deliberate overflow past the rule. */
.libRow--feature{background:var(--periwinkle);border:var(--line-thick) solid var(--ink);border-radius:var(--radius-md);margin:0 -10px 18px;padding:28px 26px;box-shadow:var(--hard-shadow)}
.libRow--feature .libIndex{opacity:.4}
.libRow--feature .libArt{width:132px;height:132px;background:var(--card);transform:rotate(4deg)}
.libRow--feature .libHead h3{font-size:clamp(23px,3vw,36px)}
@media (min-width:961px){.libRow--feature{grid-template-columns:auto 132px minmax(0,1fr)}}

/* ---------- live federated strip: visually separate from the catalog library ---------- */
.liveStrip{margin-top:34px;border-top:var(--line-thick) solid var(--ink);padding-top:22px}
.sectionHeadRow{display:flex;justify-content:space-between;align-items:baseline;gap:18px;flex-wrap:wrap;margin-bottom:6px}
.sectionNote{font-size:13px;margin:0 0 16px;max-width:70ch}

/* ---------- FOR AGENTS: machine-access surface ---------- */
.endpointList{list-style:none;margin:18px 0 0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:0;border:var(--line-thick) solid var(--ink);border-radius:var(--radius-md);overflow:hidden;background:var(--card)}
.endpoint{padding:14px 16px;border-right:var(--line) solid var(--ink);border-bottom:var(--line) solid var(--ink)}
.endpoint h3{margin:0 0 5px;font-size:14px}
.endpoint p{font-size:12.5px;margin:0 0 8px;max-width:46ch}
.endpointUrl{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;background:var(--paper);border:1px solid var(--ink);border-radius:6px;padding:5px 8px;display:block;word-break:break-all;font-weight:700}
.toolList{list-style:none;margin:12px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:8px}
.toolList li{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;border:var(--line) solid var(--ink);border-radius:999px;padding:4px 11px;background:var(--card);font-weight:700}
.toolList--denied li{background:transparent;border-style:dashed;color:var(--ink-soft);text-decoration:line-through}

/* ---------- FOR AGENTS: code blocks. Ink field, paper text: maximum contrast, real monospace,
   horizontally scrollable in their own box so the page body never scrolls sideways. ---------- */
.codeCard{border:var(--line-thick) solid var(--ink);border-radius:var(--radius-sm);overflow:hidden;margin:12px 0 0;background:var(--ink)}
.codeHead{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 13px;background:var(--yellow);color:var(--ink);border-bottom:var(--line) solid var(--ink);font-size:10.5px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}
.codeHead--in{background:var(--cyan)}
.codeHead--out{background:var(--periwinkle)}
.codeHead--refuse{background:var(--alarm)}
.codeCard pre{margin:0;padding:15px 17px;overflow-x:auto;color:var(--paper);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12.5px;line-height:1.62;tab-size:2}
.codeCard code{font:inherit;color:inherit;background:none;border:0;padding:0}
.copyButton{font-family:inherit;font-size:10px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;border:var(--line) solid var(--ink);border-radius:999px;background:var(--card);color:var(--ink);padding:3px 10px;cursor:pointer;transition:transform 150ms ease,box-shadow 150ms ease}
.copyButton:hover{transform:translate(-1px,-1px);box-shadow:2px 2px 0 var(--ink)}
.copyButton[hidden]{display:none}

/* ---------- FOR AGENTS: the flow spine. One numbered editorial column, not a card grid. ------- */
.flow{list-style:none;margin:24px 0 0;padding:0;counter-reset:flowstep}
.flowStep{position:relative;display:grid;grid-template-columns:auto minmax(0,1fr);gap:8px 20px;padding:24px 0;border-top:var(--line) solid var(--ink)}
.flowStep:first-child{border-top:var(--line-thick) solid var(--ink)}
.flowNum{counter-increment:flowstep;font-size:clamp(30px,4vw,52px);font-weight:900;letter-spacing:-.06em;line-height:.9;opacity:.24;transform:rotate(-7deg);min-width:2ch}
.flowNum::before{content:"0" counter(flowstep)}
.flowBody{min-width:0}
.flowBody h3{margin:0 0 6px;font-size:clamp(18px,2.1vw,25px);letter-spacing:-.035em}
.flowBody > p{font-size:13.5px;margin:0;max-width:64ch}
.flowAside{font-size:12.5px;margin:12px 0 0;border-left:var(--line-thick) solid var(--lavender);background:var(--paper);padding:9px 13px;border-radius:0 10px 10px 0;font-weight:600;max-width:64ch}

/* The refusal is the page's second dominant object: a full-bleed alarm-edged field, deliberately
   breaking the frame's inner margin so it reads as the punchline rather than another section. */
.refusal{border:var(--line-thick) solid var(--ink);border-radius:var(--radius-md);background:var(--card);padding:clamp(20px,3vw,34px);margin:32px -10px;box-shadow:var(--hard-shadow);position:relative}
.refusal::before{content:"";position:absolute;left:0;top:22px;bottom:22px;width:10px;background:var(--alarm);border-right:var(--line) solid var(--ink)}
.refusal h2{font-size:clamp(24px,3.6vw,44px);line-height:.98;max-width:18ch}
.refusalGrid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:clamp(16px,2.4vw,28px);align-items:start;margin-top:18px}
.agentArt{width:100%;max-width:430px;justify-self:center}
.agentArt svg{width:100%;height:auto;display:block;overflow:visible}

/* ---------- upcoming-section notice: honest about what is not built yet ---------- */
.upcoming{border:var(--line-thick) dashed var(--ink);border-radius:var(--radius-md);background:var(--paper);padding:20px 22px;margin-top:26px}
.upcoming h2{font-size:clamp(17px,1.8vw,22px)}
.upcoming p{font-size:13.5px;margin:0 0 10px}

/* ---------- notices ---------- */
.demoBanner{border:var(--border);border-radius:var(--radius-sm);padding:13px 17px;font-size:13.5px;font-weight:700;margin-bottom:22px;background:var(--periwinkle);box-shadow:var(--hard-shadow-sm)}
.footer{grid-column:1 / -1;display:flex;justify-content:space-between;flex-wrap:wrap;gap:14px;padding:0 4px 34px;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-soft)}
.footer span{max-width:80ch}

/* ---------- motion ---------- */
@keyframes drift{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(-9px) rotate(2deg)}}
@keyframes driftSlow{0%,100%{transform:translateY(0) rotate(4deg)}50%{transform:translateY(7px) rotate(-2deg)}}
.float{animation:drift 7s ease-in-out infinite}
.float--slow{animation:driftSlow 9.5s ease-in-out infinite}
@media (prefers-reduced-motion: reduce){
  *{animation:none !important;transition:none !important}
  .button:hover,.resultCard:hover,.railNav a:hover .railNum{transform:none}
}

/* ---------- responsive: recomposed, not shrunk ---------- */
@media (max-width:960px){
  .hero{grid-template-columns:1fr}
  .heroArt{order:-1;max-width:280px;margin-bottom:6px;justify-self:start}
  /* Recomposed, not scaled (design skill §12): every frame-escaping object is REMOVED below the
     desktop breakpoint — there is no gutter left for them to escape into, and the skill is explicit
     that decorative objects may be dropped when they would interfere with hierarchy. The single
     hero illustration cluster and the colour field survive. */
  .escape{display:none}
  .page{padding:18px 16px 0}
  .rail{top:18px;height:calc(100vh - 36px)}
  /* The diagonal field turns into a shallow top band so it stays a colour ZONE rather than a wedge
     cutting through the headline on a narrow column. */
  .hero::before{width:100%;height:60%;clip-path:polygon(0 0, 100% 0, 100% 74%, 0 100%)}
  body::before{clip-path:polygon(0 0, 100vw 0, 100vw 22vh, 0 44vh)}
  body::after{display:none}
  .scanGrid{grid-template-columns:1fr}
  .passportHead{grid-template-columns:1fr}
  .passportStamp{width:108px}
  .libRow{grid-template-columns:auto 76px minmax(0,1fr);gap:6px 16px}
  .libArt{width:76px;height:76px;border-radius:14px}
  .libRow--feature .libArt{width:96px;height:96px}
  .refusalGrid{grid-template-columns:1fr}
}
/* ── Verified Library (PR 3/4) ───────────────────────────────────────────────
   The four states are shown as a ledger of chips, never as one badge. An established state gets a
   filled glyph and a flat accent field; an unestablished one gets a hollow glyph, a dashed
   outline and the words "not established" — so the distinction survives with colour removed, in a
   screen reader, and in print. Each state owns a distinct accent, and none of them is green:
   there is no "all clear" colour in this system because there is no all-clear claim. */
.stateLedger{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 14px}
.stateChip{display:inline-flex;align-items:center;gap:7px;font-size:11px;font-weight:900;letter-spacing:.07em;text-transform:uppercase;border:var(--line) solid var(--ink);border-radius:999px;padding:5px 13px;background:var(--paper)}
.stateChip__glyph{font-size:9px;line-height:1}
.stateChip--on.stateChip--INDEXED{background:var(--lavender)}
.stateChip--on.stateChip--AUDITED{background:var(--periwinkle)}
.stateChip--on.stateChip--VERIFIED{background:var(--cyan)}
.stateChip--on.stateChip--STORED_ON_0G{background:var(--yellow);box-shadow:var(--hard-shadow-sm)}
.stateChip--off{border-style:dashed;color:var(--ink-soft);background:transparent;font-weight:800}
.stateChip__not{font-weight:700;letter-spacing:.04em;text-transform:none;opacity:.75}
.absenceList{list-style:none;margin:0 0 12px;padding:10px 14px;border-left:var(--line-thick) solid var(--ink);background:var(--paper-deep);border-radius:0 var(--radius-sm) var(--radius-sm) 0;display:flex;flex-direction:column;gap:6px}
.absenceList li{font-size:12px;line-height:1.5}
.pubBlock{border:var(--line) solid var(--ink);border-radius:var(--radius-sm);background:var(--card);padding:14px 16px;margin:0 0 14px;position:relative}
.pubBlock .edgeLabel{position:static;display:block;margin-bottom:8px;transform:none;writing-mode:horizontal-tb}
.pubNote{font-size:12px;margin:10px 0 0;color:var(--ink-soft);line-height:1.55}
/* The state key is the page's one dominant explanatory object: an oversized, off-grid strip that
   defines the vocabulary before a single row is read. */
.stateKey{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:0;border:var(--line-thick) solid var(--ink);border-radius:var(--radius-md);overflow:hidden;margin:26px -6px 0;background:var(--card)}
.stateKeyItem{padding:16px 18px;border-right:var(--line) solid var(--ink);display:flex;flex-direction:column;gap:6px}
.stateKeyItem:last-child{border-right:0}
.stateKeyLabel{font-size:12px;font-weight:900;letter-spacing:.1em;text-transform:uppercase}
.stateKeyMeaning{font-size:12px;line-height:1.5;color:var(--ink-soft)}
.stateKeyItem--INDEXED{background:var(--lavender)}
.stateKeyItem--AUDITED{background:var(--periwinkle)}
.stateKeyItem--VERIFIED{background:var(--cyan)}
.stateKeyItem--STORED_ON_0G{background:var(--yellow)}
.stateKeyItem--INDEXED .stateKeyMeaning,.stateKeyItem--AUDITED .stateKeyMeaning,
.stateKeyItem--VERIFIED .stateKeyMeaning,.stateKeyItem--STORED_ON_0G .stateKeyMeaning{color:var(--ink)}
.tallyStrip{display:flex;flex-wrap:wrap;gap:14px;margin:20px 0 8px}
.tally{border:var(--border);border-radius:var(--radius-sm);padding:10px 18px;background:var(--paper);display:flex;flex-direction:column;gap:2px;min-width:104px}
.tally--zerog{background:var(--yellow);box-shadow:var(--hard-shadow-sm);transform:rotate(-1.5deg)}
.tallyNum{font-size:30px;font-weight:900;letter-spacing:-.05em;line-height:1}
.tallyLabel{font-size:10px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-soft)}
.tally--zerog .tallyLabel{color:var(--ink)}
@media (max-width:640px){
  .page{grid-template-columns:1fr;padding:12px 12px 0}
  .rail{display:none}
  .topbar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;border:var(--border);border-radius:var(--radius-md);background:var(--card);padding:10px 14px;margin-bottom:14px}
  .topbarMark{display:flex;align-items:center;gap:9px;font-size:14px;font-weight:900;letter-spacing:-.03em}
  .topbarMark .brandMark{border-radius:9px}
  .topbarNav{display:flex;gap:7px;flex-wrap:wrap}
  .topbarNav a{border:var(--border);border-radius:999px;padding:5px 11px;font-size:10px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;background:var(--paper)}
  .topbarNav a.active{background:var(--yellow)}
  .frame{padding:20px 16px;border-radius:var(--radius-md);border-width:var(--line)}
  h1{font-size:clamp(34px,10vw,48px);max-width:none}
  .fieldRow,.hashRow,.summaryRow{grid-template-columns:1fr;gap:5px;padding:9px 0}
  .searchForm{flex-direction:column}
  .searchForm input[type="search"]{width:100%}
  .searchForm .button{width:100%}
  .resultCard{grid-template-columns:1fr;padding:18px 16px 18px 22px}
  .cardStamp{display:none}
  .float,.float--slow{animation:none}
  .historyWhen{min-width:0;width:100%}
  .footer{padding-bottom:24px}
  /* Library recomposed rather than shrunk (design skill §12): the index numeral and the one
     illustration form a compact header strip, and the text block takes the full width beneath it
     instead of being squeezed into a third column. */
  .libRow{grid-template-columns:auto minmax(0,1fr);gap:12px;padding:20px 0}
  .libIndex{font-size:26px;align-self:center}
  .libArt{width:64px;height:64px;border-radius:12px;transform:rotate(-4deg)}
  .libBody{grid-column:1 / -1}
  .libRow--feature{margin:0 0 16px;padding:20px 16px;box-shadow:var(--hard-shadow-sm)}
  .libRow--feature .libArt{width:78px;height:78px}
  .libFacts{grid-template-columns:1fr}
  .catRail{gap:6px}
  /* The state key becomes a stacked list of full-width bands rather than a squeezed four-column
     strip: each state keeps its own colour field and reads as its own statement. */
  .stateKey{grid-template-columns:1fr;margin:20px 0 0}
  .stateKeyItem{border-right:0;border-bottom:var(--line) solid var(--ink)}
  .stateKeyItem:last-child{border-bottom:0}
  .stateLedger{gap:6px}
  .stateChip{font-size:10px;padding:5px 11px}
  .tallyStrip{gap:10px}
  .tally{flex:1 1 calc(50% - 10px);min-width:0;padding:9px 13px}
  .tally--zerog{transform:none}
  .tallyNum{font-size:24px}
  .pubBlock{padding:12px 13px}
  /* FOR AGENTS, recomposed rather than shrunk: the flow numeral becomes a header chip above its
     own step instead of a squeezed left column, the refusal loses its negative margin and hard
     shadow, and the endpoint table becomes a single stacked column. */
  .flowStep{grid-template-columns:1fr;gap:4px;padding:20px 0}
  .flowNum{font-size:26px;transform:rotate(-5deg);opacity:.32}
  .refusal{margin:24px 0;padding:18px 16px;box-shadow:none}
  .refusal::before{width:7px}
  .refusalGrid{grid-template-columns:1fr}
  .endpoint{border-right:0}
  .codeCard pre{font-size:11.5px;padding:12px 13px}
  .agentArt{max-width:100%}
}
`;

/**
 * The one shared illustration vocabulary for the whole product: an outlined **stamp** ring (the
 * seal AegisOne presses only when real evidence exists) and a **byte grid** (the bytes it actually
 * compares). Everything decorative on every page is assembled from these two symbols plus a
 * comparison arrow — no second metaphor, no raster/stock art, no external asset requests.
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
<symbol id="ic-cube" viewBox="0 0 64 68">
  <path d="M32 3 60 18v32L32 65 4 50V18Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/>
  <path d="M4 18l28 15 28-15M32 33v32" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/>
</symbol>
<symbol id="ic-zig" viewBox="0 0 76 44">
  <path d="M4 32h20l8-20 10 24 7-14h16" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M58 12l10 10-10 10" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
</symbol>
<symbol id="ic-lens" viewBox="0 0 64 64">
  <circle cx="26" cy="26" r="21" fill="none" stroke="currentColor" stroke-width="4.5"/>
  <path d="M41 41 58 58" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>
</symbol>
</defs></svg>`;

/**
 * The **brand mark** — the repo owner's real AegisOne logo file, served verbatim from this origin at
 * `/static/brand/logo.jpg` (`apps/web/src/static-assets.ts`). This is deliberately *not* generated
 * or reinterpreted here: the previous redesign invented an SVG "stamp ring + byte grid" mark and
 * used it as the logo, which was wrong.
 *
 * Note the distinction, which the rest of the codebase depends on: the brand mark identifies the
 * product (nav + favicon, this function), while the stamp/byte-grid SVG vocabulary (`#ic-stamp`,
 * `#ic-bytegrid`) is *verdict illustration* for MATCH/MISMATCH/CLEAN/FLAGGED and is unchanged.
 *
 * The logo art is black-on-white, so it sits inside a single outlined light frame (the design
 * language's `GraphicFrame` primitive) rather than floating on the paper background as a stray
 * white box.
 */
export function brandLogoImg(size = 56): string {
  return `<span class="brandMark" style="--brand-size:${size}px"><img src="/static/brand/logo.jpg" width="${size}" height="${size}" alt="AegisOne" decoding="async"></span>`;
}

/**
 * ---------------------------------------------------------------------------------------------
 * Frame-escaping decorative objects (design skill §9 "Controlled Anti-Grid", §15 hero formula
 * step 9: "two to five decorative objects breaking the frame boundary").
 *
 * These are drawn from the SAME shape family as everything else in the product — outlined cube /
 * package, byte grid, chunky arrow, connector, lens, stamp ring — so nothing here introduces a
 * second, unrelated metaphor. All inline SVG; no raster art, no external request.
 *
 * Rules enforced here rather than left to each page:
 *   - every object is `aria-hidden` and `pointer-events:none` (see `.escape` in STYLE), so an
 *     object that overhangs a control can still never intercept a click or reach a screen reader;
 *   - slots are fixed named positions in the page gutter, never free-form coordinates, so an
 *     object cannot be dropped on top of the search box or the CTA row by accident;
 *   - rotations stay inside the skill's -6°..6° range;
 *   - all of them are `display:none` below 960px.
 *
 * The verdict stamp (`#ic-stamp`) is deliberately NOT offered as a decorative escape object: the
 * stamp means AegisOne actually holds evidence, and scattering it as ornament would be exactly the
 * overstatement this product exists to refuse.
 */
export type EscapeSlot = "tl" | "tr" | "rt" | "bl" | "br";

export type EscapeShape = "cube" | "bytegrid" | "zig" | "lens" | "node" | "chip";

const ESCAPE_SHAPES: Record<EscapeShape, string> = {
  // An outlined package/cube: the unit of thing AegisOne indexes.
  cube: `<svg viewBox="0 0 72 76" aria-hidden="true" focusable="false"><g color="#0a0a0a">
    <path d="M36 6 66 22v32L36 70 6 54V22Z" fill="#b79cff" stroke="#0a0a0a" stroke-width="4" stroke-linejoin="round"/>
    <path d="M6 22l30 16 30-16M36 38v32" fill="none" stroke="#0a0a0a" stroke-width="4" stroke-linejoin="round"/>
  </g></svg>`,
  // The bytes AegisOne compares, on its own outlined tile.
  bytegrid: `<svg viewBox="0 0 76 76" aria-hidden="true" focusable="false"><g color="#0a0a0a">
    <rect x="3" y="3" width="70" height="70" rx="16" fill="#fffdf7" stroke="#0a0a0a" stroke-width="4"/>
    <use href="#ic-bytegrid" x="14" y="14" width="48" height="48"/>
  </g></svg>`,
  // A chunky zig-zag arrow: the comparison actually travelling somewhere.
  zig: `<svg viewBox="0 0 92 60" aria-hidden="true" focusable="false"><g color="#0a0a0a">
    <rect x="3" y="8" width="86" height="44" rx="22" fill="#22dceb" stroke="#0a0a0a" stroke-width="4"/>
    <use href="#ic-zig" x="11" y="19" width="70" height="22"/>
  </g></svg>`,
  // The inspection itself.
  lens: `<svg viewBox="0 0 72 72" aria-hidden="true" focusable="false"><g color="#0a0a0a">
    <circle cx="30" cy="30" r="22" fill="#ffd91a" stroke="#0a0a0a" stroke-width="4.5"/>
    <use href="#ic-bytegrid" x="18" y="18" width="24" height="24"/>
    <path d="M46 46 64 64" fill="none" stroke="#0a0a0a" stroke-width="8" stroke-linecap="round"/>
  </g></svg>`,
  // A connector node: one record linked to another.
  node: `<svg viewBox="0 0 84 56" aria-hidden="true" focusable="false"><g color="#0a0a0a">
    <circle cx="16" cy="28" r="12" fill="#d8e1ff" stroke="#0a0a0a" stroke-width="4"/>
    <circle cx="68" cy="28" r="12" fill="#0a0a0a"/>
    <path d="M28 28h28" fill="none" stroke="#0a0a0a" stroke-width="4" stroke-linecap="round" stroke-dasharray="7 6"/>
  </g></svg>`,
  // A small detached slot/chip: one dimension of evidence, still empty.
  chip: `<svg viewBox="0 0 64 44" aria-hidden="true" focusable="false"><g color="#0a0a0a">
    <rect x="3" y="3" width="58" height="38" rx="12" fill="#fffdf7" stroke="#0a0a0a" stroke-width="4"/>
    <rect x="13" y="15" width="14" height="14" rx="4" fill="#0a0a0a"/>
    <rect x="33" y="15" width="14" height="14" rx="4" fill="none" stroke="#0a0a0a" stroke-width="3.5"/>
  </g></svg>`,
};

export interface EscapeObject {
  slot: EscapeSlot;
  shape: EscapeShape;
  /** `near` = large and high-contrast; `far` = small, reads as depth. */
  depth: "near" | "far";
  /** Ambient drift. Disabled wholesale under `prefers-reduced-motion` (see STYLE). */
  drift?: "fast" | "slow";
}

export function escapeObjectsHtml(objects: readonly EscapeObject[]): string {
  return objects
    .map((object) => {
      // The drift animation lives on an INNER element: the outer .escape--<slot> rule owns
      // `transform: rotate(...)`, and a keyframe on the same element would silently replace it.
      const drift = object.drift === "fast" ? " float" : object.drift === "slow" ? " float--slow" : "";
      return `<span class="escape escape--${object.depth} escape--${object.slot}" aria-hidden="true"><span class="escapeInner${drift}">${ESCAPE_SHAPES[object.shape]}</span></span>`;
    })
    .join("");
}

/**
 * The four-section information architecture (ADR-016). Primary navigation is exactly these four
 * and nothing else:
 *
 *   SKILLS      what you can get      the browsable, evidence-annotated skill library
 *   AUDIT       check something now   paste-to-scan, the real POST /api/v1/scan surface
 *   VERIFIED    what AegisOne proved  resources AegisOne actually holds evidence for
 *   FOR AGENTS  machine access        the live MCP endpoint and stable read API
 *
 * `Claim` was removed from primary navigation: authenticating a source claim is a publisher-side
 * task, not something a first-time visitor should be asked to do. The `/source/claim` route and
 * every piece of M8.5 source-authentication code remain fully working and reachable by direct URL
 * and from the footer — nothing was deleted. `/proof` (the M1-M7 live 0G evidence ledger) likewise
 * leaves primary nav and keeps a footer link.
 */
const NAV_ITEMS: ReadonlyArray<{ href: string; num: string; label: string; key: LayoutOptions["activeNav"] }> = [
  { href: "/", num: "01", label: "Skills", key: "skills" },
  { href: "/audit", num: "02", label: "Audit", key: "audit" },
  { href: "/verified", num: "03", label: "Verified", key: "verified" },
  { href: "/agents", num: "04", label: "For agents", key: "agents" },
];

function railNav(active: LayoutOptions["activeNav"]): string {
  return NAV_ITEMS.map((item) => {
    const isActive = item.key !== "none" && item.key === active;
    return `<li><a href="${item.href}"${isActive ? ' class="active" aria-current="page"' : ""}><span class="railNum" aria-hidden="true">${item.num}</span>${item.label}</a></li>`;
  }).join("");
}

function topbarNav(active: LayoutOptions["activeNav"]): string {
  return NAV_ITEMS.map((item) => {
    const isActive = item.key !== "none" && item.key === active;
    return `<a href="${item.href}"${isActive ? ' class="active" aria-current="page"' : ""}>${item.label}</a>`;
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
    <a href="/" aria-label="AegisOne home">${brandLogoImg(56)}</a>
    <ul class="railNav">${railNav(options.activeNav)}</ul>
    <span class="railEdge" aria-hidden="true">Evidence, not adjectives</span>
  </nav>
  <div>
    <nav class="topbar" aria-label="Primary (compact)">
      <a class="topbarMark" href="/">${brandLogoImg(30)} AegisOne</a>
      <div class="topbarNav">${topbarNav(options.activeNav)}</div>
    </nav>
    <main class="frame" id="main">
      ${options.bodyHtml}
    </main>
  </div>
  <footer class="footer">
    <span>Discovery, source assurance, correspondence, security and policy are always shown as independent dimensions — never collapsed into one trust score.</span>
    <span class="footerLinks"><a href="/proof">0G evidence ledger</a> · <a href="/source/claim">Claim a source</a> · <a href="https://github.com/Ollie202/aegisone" rel="noopener noreferrer" target="_blank">public source</a></span>
  </footer>
</div>
${options.scriptTag ?? ""}
</body>
</html>`;
}
