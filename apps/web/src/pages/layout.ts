// Shared HTML shell for the M9 Hub (light/modern theme, ADR-013). Server-only TypeScript, pure
// function, directly unit-testable — mirrors the existing pattern in `render.ts`/`render-skill.ts`.

export interface LayoutOptions {
  title: string;
  activeNav: "hub" | "resource" | "source-claim" | "none";
  bodyHtml: string;
  /** A raw <script> tag (already trusted, authored by this codebase) appended before </body>. */
  scriptTag?: string;
}

const STYLE = `
:root{
  --bg:#ffffff; --bg-subtle:#f7f8fa; --border:#e4e7ec; --text:#111318; --text-muted:#5b6472;
  --accent:#2563eb; --accent-contrast:#ffffff;
  --positive:#0f7a3d; --positive-bg:#e9f7ee; --positive-border:#bfe6cd;
  --negative:#b3261e; --negative-bg:#fdecea; --negative-border:#f3c2bd;
  --caution:#8a5a00; --caution-bg:#fff6e0; --caution-border:#f0dca0;
  --info:#1d4ed8; --info-bg:#eef2ff; --info-border:#c7d2fe;
  --neutral:#5b6472; --neutral-bg:#f1f2f4; --neutral-border:#dde0e5;
  --radius:12px; --shadow:0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.06);
  font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg:#0e1116; --bg-subtle:#151a21; --border:#262c36; --text:#e8ebf0; --text-muted:#9aa4b2;
  }
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);line-height:1.5}
a{color:var(--accent);text-decoration:none}
a:hover{text-decoration:underline}
.shell{max-width:1080px;margin:0 auto;padding:0 20px 64px}
.topnav{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:20px 0;border-bottom:1px solid var(--border);margin-bottom:28px}
.brand{font-weight:800;letter-spacing:-.02em;font-size:18px;color:var(--text)}
.navlinks{display:flex;gap:6px;flex-wrap:wrap}
.navlinks a{padding:8px 12px;border-radius:8px;color:var(--text-muted);font-size:14px;font-weight:600}
.navlinks a.active,.navlinks a:hover{background:var(--bg-subtle);color:var(--text);text-decoration:none}
h1{font-size:28px;letter-spacing:-.02em;margin:0 0 8px}
h2{font-size:18px;letter-spacing:-.01em;margin:0 0 14px}
p{color:var(--text-muted)}
.card{background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);box-shadow:var(--shadow);padding:20px}
.badge{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:4px 10px;font-size:12px;font-weight:700;letter-spacing:.02em;border:1px solid}
.badge--neutral{background:var(--neutral-bg);border-color:var(--neutral-border);color:var(--neutral)}
.badge--positive{background:var(--positive-bg);border-color:var(--positive-border);color:var(--positive)}
.badge--negative{background:var(--negative-bg);border-color:var(--negative-border);color:var(--negative)}
.badge--caution{background:var(--caution-bg);border-color:var(--caution-border);color:var(--caution)}
.badge--info{background:var(--info-bg);border-color:var(--info-border);color:var(--info)}
.badge__glyph{font-size:12px}
.button{display:inline-flex;align-items:center;justify-content:center;padding:9px 16px;border-radius:9px;font-weight:650;font-size:14px;border:1px solid var(--border);background:var(--bg);color:var(--text);cursor:pointer}
.button--primary{background:var(--accent);border-color:var(--accent);color:var(--accent-contrast)}
.button:hover{text-decoration:none;filter:brightness(0.98)}
.searchForm{display:flex;gap:10px;margin:20px 0 8px}
.searchForm input[type="search"]{flex:1;padding:12px 14px;border-radius:10px;border:1px solid var(--border);font-size:15px;background:var(--bg);color:var(--text)}
.searchHint{color:var(--text-muted);font-size:13px;margin-bottom:20px}
.federationRow{display:flex;gap:14px;align-items:center;flex-wrap:wrap;font-size:13px;color:var(--text-muted);margin-bottom:18px}
.resultGrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}
.resultCard{border:1px solid var(--border);border-radius:var(--radius);padding:16px;background:var(--bg);box-shadow:var(--shadow)}
.cardHead{display:flex;justify-content:space-between;align-items:start;gap:8px}
.cardHead h3{margin:0;font-size:15px}
.kindTag{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);border:1px solid var(--border);border-radius:6px;padding:2px 6px;white-space:nowrap}
.cardDescription{font-size:13px;margin:8px 0}
.cardBadges{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0}
.cardNote{font-size:12px;color:var(--text-muted);align-self:center}
.cardMeta{display:flex;gap:12px;font-size:12px;color:var(--text-muted)}
.relevance{border:1px dashed var(--border);border-radius:6px;padding:1px 6px}
.cardUrl{margin-top:8px;font-size:12px;word-break:break-all}
.providerStatusList{list-style:none;padding:0;margin:0 0 14px;display:flex;flex-wrap:wrap;gap:8px}
.providerStatus{font-size:12px;border-radius:8px;padding:5px 10px;border:1px solid var(--border)}
.providerStatus--ok{color:var(--positive)}
.providerStatus--down{color:var(--caution)}
.emptyState{color:var(--text-muted);font-size:14px}
.passportSection{border:1px solid var(--border);border-radius:var(--radius);padding:18px;margin-bottom:16px;background:var(--bg)}
.fieldRow{display:grid;grid-template-columns:200px 1fr;gap:12px;padding:6px 0;font-size:14px;align-items:start}
.fieldLabel{color:var(--text-muted);font-weight:600}
.hashRow{display:grid;grid-template-columns:200px 1fr;gap:12px;padding:6px 0;align-items:start}
.hashLabel{color:var(--text-muted);font-size:13px;font-weight:600}
.hashValue{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;word-break:break-all}
.hashValue--empty{color:var(--text-muted)}
.passportDescription,.passportNote{font-size:13px}
.passportWarning{font-size:13px;border-left:3px solid var(--caution);padding-left:10px;color:var(--text)}
.integrityWarning{font-size:13px;border-left:3px solid var(--negative);padding-left:10px;color:var(--text)}
.findingList{font-size:13px;padding-left:18px}
.historyList{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:8px}
.historyRow{display:flex;gap:10px;align-items:center;font-size:13px;flex-wrap:wrap}
.historyWhen{color:var(--text-muted);min-width:170px}
.policyForm{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;align-items:end;margin-bottom:16px}
.policyField label{display:block;font-size:12px;color:var(--text-muted);margin-bottom:6px;font-weight:600}
.policyField select,.policyField input{width:100%;padding:8px 10px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text)}
.policyField--checkbox{display:flex;align-items:center}
.policyField--checkbox label{display:flex;gap:8px;align-items:center;font-size:13px;color:var(--text)}
.policyResult{border:1px solid var(--border);border-radius:var(--radius);padding:16px;background:var(--bg-subtle)}
.policyDecision{margin-bottom:10px}
.policyReasons{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:6px}
.policyReason{font-size:13px}
.policyReason code{font-size:11px;background:var(--neutral-bg);border-radius:4px;padding:1px 5px}
.errorText{color:var(--negative)}
.repoList{display:flex;flex-direction:column;gap:8px;max-height:320px;overflow:auto;border:1px solid var(--border);border-radius:10px;padding:10px}
.repoOption{font-size:13px;display:flex;gap:8px;align-items:center}
.repoNote{font-size:11px;color:var(--text-muted)}
.repoNote--good{color:var(--positive)}
.claimResult{border:1px solid var(--border);border-radius:var(--radius);padding:16px;background:var(--bg-subtle)}
.stepList{counter-reset:step;padding:0;list-style:none}
.stepList li{position:relative;padding-left:34px;margin-bottom:16px;font-size:14px}
.stepList li::before{counter-increment:step;content:counter(step);position:absolute;left:0;top:0;width:24px;height:24px;border-radius:50%;background:var(--bg-subtle);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700}
.formGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}
.formGrid label{font-size:12px;color:var(--text-muted);font-weight:600;display:block;margin-bottom:6px}
.formGrid input{width:100%;padding:8px 10px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text)}
.demoBanner{background:var(--info-bg);border:1px solid var(--info-border);color:var(--info);border-radius:10px;padding:10px 14px;font-size:13px;margin-bottom:18px}
.footer{margin-top:48px;padding-top:20px;border-top:1px solid var(--border);color:var(--text-muted);font-size:12px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px}
@media (max-width:640px){
  .shell{padding:0 14px 48px}
  .fieldRow,.hashRow{grid-template-columns:1fr}
  .searchForm{flex-direction:column}
  .topnav{flex-direction:column;align-items:flex-start;gap:10px}
}
`;

function navLink(href: string, label: string, active: boolean): string {
  return `<a href="${href}"${active ? ' class="active" aria-current="page"' : ""}>${label}</a>`;
}

export function renderLayoutHtml(options: LayoutOptions): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#ffffff">
<title>${options.title}</title>
<style>${STYLE}</style>
</head>
<body>
<main class="shell">
  <nav class="topnav">
    <a class="brand" href="/">ProofRail Hub</a>
    <div class="navlinks">
      ${navLink("/", "Search", options.activeNav === "hub")}
      ${navLink("/source/claim", "Source claim", options.activeNav === "source-claim")}
      ${navLink("/proof", "Live proof ledger", false)}
    </div>
  </nav>
  ${options.bodyHtml}
  <footer class="footer">
    <span>ProofRail — discovery, source assurance, correspondence, security, and policy are always shown as independent dimensions, never a single trust score.</span>
    <span><a href="https://github.com/Ollie202/proofrail-0g" rel="noopener noreferrer" target="_blank">public source</a></span>
  </footer>
</main>
${options.scriptTag ?? ""}
</body>
</html>`;
}
