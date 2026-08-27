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
  activeNav: "hub" | "resource" | "scan" | "source-claim" | "none";
  bodyHtml: string;
  /** A raw <script> tag (already trusted, authored by this codebase) appended before </body>. */
  scriptTag?: string;
}

const STYLE = `
:root{
  --ink:#0a0a0a; --ink-soft:#3d3a34;
  --paper:#f7f5ef; --paper-deep:#efece2; --card:#fffdf7;
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
  margin:0;background:var(--paper);color:var(--ink);line-height:1.5;
  -webkit-font-smoothing:antialiased;
  background-image:radial-gradient(var(--paper-deep) 1.4px, transparent 1.4px);
  background-size:22px 22px;
}
a{color:var(--ink);text-decoration:none;text-underline-offset:3px}
a:hover{text-decoration:underline}
.sprite{position:absolute;width:0;height:0;overflow:hidden}
.skiplink{position:absolute;left:-9999px;top:0;background:var(--yellow);border:var(--border);padding:10px 16px;font-weight:800;z-index:99}
.skiplink:focus{left:12px;top:12px}
:focus-visible{outline:3px solid var(--ink);outline-offset:3px}

/* ---------- page shell: slim vertical rail + one big outlined frame ---------- */
.page{display:grid;grid-template-columns:var(--rail) minmax(0,1fr);gap:0;min-height:100vh;padding:18px 20px 0}
.rail{position:sticky;top:18px;align-self:start;height:calc(100vh - 36px);display:flex;flex-direction:column;justify-content:space-between;align-items:center;padding:0 8px 18px 0}
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
.frame{border:var(--line-thick) solid var(--ink);border-radius:var(--radius-lg);background:var(--card);padding:clamp(22px,3.4vw,52px);margin-bottom:26px;position:relative}
.topbar{display:none}

/* ---------- editorial typography ---------- */
h1,h2,h3{margin:0;letter-spacing:-.04em;font-weight:900}
h1{font-size:clamp(38px,7vw,92px);line-height:.94;margin:0 0 18px;max-width:16ch}
h1.tight{max-width:22ch}
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
.heroArt{position:relative;justify-self:center;align-self:center;width:100%;max-width:420px}
.heroArt svg{width:100%;height:auto;display:block;overflow:visible}
.heroCopy{position:relative;z-index:2}
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
  .scanGrid{grid-template-columns:1fr}
  .passportHead{grid-template-columns:1fr}
  .passportStamp{width:108px}
}
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

const NAV_ITEMS: ReadonlyArray<{ href: string; num: string; label: string; key: LayoutOptions["activeNav"] }> = [
  { href: "/", num: "01", label: "Search", key: "hub" },
  { href: "/scan", num: "02", label: "Scan", key: "scan" },
  { href: "/source/claim", num: "03", label: "Claim", key: "source-claim" },
  { href: "/proof", num: "04", label: "Ledger", key: "none" },
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
    <span><a href="https://github.com/Ollie202/aegisone" rel="noopener noreferrer" target="_blank">public source</a></span>
  </footer>
</div>
${options.scriptTag ?? ""}
</body>
</html>`;
}
