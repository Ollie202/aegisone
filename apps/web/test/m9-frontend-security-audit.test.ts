import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

/**
 * M9 (Issue #31) explicit security/XSS audit, mirroring M8.7's "no verified:true anywhere"
 * regression-test pattern: every frontend-bundle-reachable source file (everything under
 * `apps/web/public/` — served verbatim to the browser — and every isomorphic `apps/web/src/ui/`
 * module, which is also served verbatim at `/static/ui/*.mjs`) is scanned for anything
 * secret-shaped, and for the disallowed generic SAFE/TRUSTED/numeric-trust-score vocabulary.
 */

const SECRET_PATTERNS: RegExp[] = [
  /ZEROG_STORAGE_PRIVATE_KEY/i,
  /GITHUB_APP_CLIENT_SECRET/i,
  /client_secret/i,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bsk-[A-Za-z0-9]{20,}/, // OpenAI-shaped key, defense in depth even though no such dependency exists
];

/** Only source-shaped (text) assets are scanned for secrets/vocabulary; the one binary asset the
 * allowlist serves is the committed brand logo image, which carries no source text to audit and
 * would only produce meaningless UTF-8 noise here. Its *reachability* is asserted separately in
 * `hub-pages.test.ts` ("static asset allowlist serves exactly the declared files"). */
const TEXT_EXTENSIONS = [".js", ".mjs", ".cjs", ".ts", ".json", ".css", ".html", ".map", ".txt"];

async function collectFiles(dirUrl: URL): Promise<string[]> {
  const entries = await readdir(dirUrl, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const childUrl = new URL(entry.name, dirUrl);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(new URL(`${entry.name}/`, dirUrl))));
    } else if (TEXT_EXTENSIONS.some((extension) => entry.name.endsWith(extension))) {
      files.push(fileURLToPath(childUrl));
    }
  }
  return files;
}

test("every browser-reachable frontend file is free of secret-shaped values", async () => {
  const publicDir = new URL("../public/", import.meta.url);
  const uiDir = new URL("../src/ui/", import.meta.url);
  const files = [...(await collectFiles(publicDir)), ...(await collectFiles(uiDir))];
  assert.ok(files.length >= 8, "expected the M9 frontend asset set to be present");
  for (const file of files) {
    const contents = await readFile(file, "utf8");
    for (const pattern of SECRET_PATTERNS) {
      assert.doesNotMatch(contents, pattern, `${file} appears to contain a secret-shaped value (${pattern})`);
    }
  }
});

test("no browser-reachable frontend file imports a 0G/worker/secret-bearing module", async () => {
  const publicDir = new URL("../public/", import.meta.url);
  const uiDir = new URL("../src/ui/", import.meta.url);
  const files = [...(await collectFiles(publicDir)), ...(await collectFiles(uiDir))];
  for (const file of files) {
    const contents = await readFile(file, "utf8");
    assert.doesNotMatch(contents, /storage-0g|sandbox-0g|registry-0g|source-auth-github/, `${file} must not import a secret-bearing package`);
  }
});

test("the layout stylesheet declares the ADR-015 palette tokens, reduced-motion support and a mobile breakpoint", async () => {
  const layoutPath = fileURLToPath(new URL("../src/pages/layout.ts", import.meta.url));
  const contents = await readFile(layoutPath, "utf8");
  // ADR-015 "Playful Neo-Brutalist" palette, defined once as CSS custom properties.
  assert.match(contents, /--ink:#0a0a0a/);
  assert.match(contents, /--paper:#f7f5ef/);
  assert.match(contents, /--yellow:#ffd91a/);
  assert.match(contents, /--cyan:#22dceb/);
  assert.match(contents, /--lavender:#b79cff/);
  assert.match(contents, /prefers-reduced-motion: reduce/); // ambient motion is opt-out-able
  assert.match(contents, /@media \(max-width:640px\)/); // mobile breakpoint present
});

test("the trust-state accent tokens are distinct values, so INDEXED can never share a colour with MATCH", async () => {
  const layoutPath = fileURLToPath(new URL("../src/pages/layout.ts", import.meta.url));
  const contents = await readFile(layoutPath, "utf8");
  // `badges.mjs` maps INDEXED -> badge--info and MATCH -> badge--positive. Those two classes must
  // resolve to different tokens, or a bold restyle could silently make discovery-only results look
  // as "official" as proven ones (AGENTS.md: "`INDEXED` discovery state never means
  // AegisOne-verified"). The textual label/glyph distinction in badges.mjs is the primary
  // guarantee; this asserts the visual reinforcement does not undo it.
  assert.match(contents, /--tone-info:var\(--lavender\)/);
  assert.match(contents, /--tone-positive:var\(--cyan\)/);
  assert.match(contents, /--tone-negative:var\(--alarm\)/);
  assert.match(contents, /--tone-caution:var\(--amber\)/);
});

/**
 * ADR-016 extension of this audit to the new SKILLS / AUDIT / VERIFIED / FOR AGENTS pages and the
 * three new isomorphic modules they add.
 */

const PAGE_MODULES = ["skills.ts", "verified.ts", "agents.ts", "scan.ts", "resource.ts", "source-claim.ts", "layout.ts"];
const NEW_UI_MODULES = ["skill-card.mjs", "skill-category.mjs", "category-art.mjs"];

test("no server-rendered page or UI module emits a generic SAFE/TRUSTED badge or a numeric trust score", async () => {
  const files = [
    ...PAGE_MODULES.map((name) => fileURLToPath(new URL(`../src/pages/${name}`, import.meta.url))),
    ...NEW_UI_MODULES.map((name) => fileURLToPath(new URL(`../src/ui/${name}`, import.meta.url))),
    fileURLToPath(new URL("../src/library.ts", import.meta.url)),
    fileURLToPath(new URL("../src/library-seed.ts", import.meta.url)),
    // PR 3/4: the modules that decide and render the four library states, and the operator
    // publication trigger. They are the newest place a collapsed "SAFE" badge or an invented score
    // could creep in, so they are held to the same vocabulary rules as every page.
    fileURLToPath(new URL("../src/library-state.ts", import.meta.url)),
    fileURLToPath(new URL("../src/publish-trigger.ts", import.meta.url)),
    fileURLToPath(new URL("../src/publication-network.ts", import.meta.url)),
  ];
  for (const file of files) {
    const source = await readFile(file, "utf8");
    // Strip comments: these modules deliberately *discuss* the forbidden vocabulary in order to
    // explain why they refuse it. What matters is that no such string is ever rendered.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
    assert.doesNotMatch(code, /badge\([^)]*["'](SAFE|TRUSTED|VERIFIED|SECURE)["']/i, `${file} renders a forbidden collapsed badge`);
    assert.doesNotMatch(code, /\b(trustScore|safetyScore|overallScore|riskScore)\b/, `${file} invents a numeric trust score`);
    assert.doesNotMatch(code, /"verified"\s*:\s*true|verified:\s*true/, `${file} emits a bare verified:true`);
    assert.doesNotMatch(code, /"safe"\s*:\s*true|safe:\s*true/, `${file} emits a bare safe:true`);
  }
});

test("the new UI modules handle external text safely, each in the way its role requires", async () => {
  const read = async (name: string) =>
    readFile(fileURLToPath(new URL(`../src/ui/${name}`, import.meta.url)), "utf8");

  // skill-card.mjs is the only one of the three that renders external text into HTML, so it must
  // route everything through the shared escaper.
  const card = await read("skill-card.mjs");
  assert.match(card, /import \{[^}]*escapeHtml[^}]*\} from "\.\/escape\.mjs"/);
  assert.match(card, /safeHttpUrl/, "URLs must go through the http(s)-only guard");

  // category-art.mjs emits only its own hardcoded SVG constants. It must never interpolate
  // anything caller-supplied beyond the class name it is given.
  const art = await read("category-art.mjs");
  const artInterpolations = new Set([...art.matchAll(/\$\{([A-Za-z_][\w.]*)/g)].map((match) => match[1]));
  for (const name of artInterpolations) {
    assert.ok(
      // `fill` is the `SF(fill)` helper's own parameter, and every call site passes one of the
      // hardcoded palette constants above — asserted separately below.
      ["INK", "YELLOW", "LAVENDER", "CYAN", "PERIWINKLE", "CARD", "S", "SF", "fill", "inner", "className", "options.className"].includes(name),
      `category-art.mjs interpolates unexpected value: ${name}`,
    );
  }
  for (const [, argument] of art.matchAll(/\bSF\(([^)]*)\)/g)) {
    assert.ok(
      ["fill", "INK", "YELLOW", "LAVENDER", "CYAN", "PERIWINKLE", "CARD"].includes(argument.trim()),
      `SF() must only ever be given a hardcoded palette constant, got: ${argument}`,
    );
  }

  // skill-category.mjs renders no HTML at all — it is a pure classifier and must stay that way,
  // which is exactly why it needs (and has) no escaper and no imports.
  const category = await read("skill-category.mjs");
  assert.doesNotMatch(category, /<[a-z]+[\s>]/, "skill-category.mjs must not render markup");
  assert.doesNotMatch(category, /^\s*import\s/m, "skill-category.mjs must stay import-free");
});

test("the new UI modules are on the static allowlist, so SSR and the browser share one renderer", async () => {
  const { listStaticAssetPaths } = await import("../src/static-assets.ts");
  const served = listStaticAssetPaths();
  for (const name of NEW_UI_MODULES) {
    assert.ok(served.includes(`/static/ui/${name}`), `${name} must be served for the browser to import`);
  }
});

test("INDEXED and the verdict states keep distinct textual labels, not just distinct colours", async () => {
  const badges = await readFile(fileURLToPath(new URL("../src/ui/badges.mjs", import.meta.url)), "utf8");
  // Each of the new dimension badges carries a full text label plus a glyph.
  assert.match(badges, /"ON 0G STORAGE"/);
  assert.match(badges, /"NOT STORED ON 0G"/);
  assert.match(badges, /"VALID SKILL PACKAGE"/);
  assert.match(badges, /NOT A VALID SKILL PACKAGE/);
  // Absence of 0G storage is stated as missing evidence, never as a finding against the resource.
  assert.match(badges, /missing evidence, not a finding against this resource/);
});


/**
 * PR 3/4 additions: the signer boundary and the 0G publication state, asserted from the frontend
 * side. `apps/worker/test/signer-boundary.test.ts` asserts the same boundary from the worker side;
 * both exist because this is the invariant that keeps a funded signer off the public deployment.
 */

test("no frontend-reachable file references the worker internal or operator publication tokens", async () => {
  const publicDir = new URL("../public/", import.meta.url);
  const uiDir = new URL("../src/ui/", import.meta.url);
  const files = [...(await collectFiles(publicDir)), ...(await collectFiles(uiDir))];
  for (const file of files) {
    const contents = await readFile(file, "utf8");
    for (const secret of [/AEGISONE_WORKER_INTERNAL_TOKEN/, /AEGISONE_PUBLISH_OPERATOR_TOKEN/, /PROOFRAIL_WORKER_INTERNAL_TOKEN/]) {
      assert.doesNotMatch(contents, secret, `${file} must not reference a publication secret`);
    }
  }
});

test("the 0G storage badge cannot be produced by an arbitrary truthy value", async () => {
  const { zeroGStorageBadge } = await import("../src/ui/badges.mjs");
  // Anything that is not a structurally valid, non-zero 32-byte root must render the absent state.
  for (const value of ["true", "yes", "1", "stored", "0x", "0xabc", `0x${"0".repeat(64)}`, `0x${"z".repeat(64)}`, true, 1, {}, [], null, undefined]) {
    const html = zeroGStorageBadge(value as never);
    assert.match(html, /NOT STORED ON 0G/, `value ${JSON.stringify(value)} must not render a positive 0G storage badge`);
  }
  // Only a well-formed non-zero root does.
  assert.match(zeroGStorageBadge(`0x${"ab".repeat(32)}`), /ON 0G STORAGE/);
});

test("the library state vocabulary never collapses the four facts into one verdict word", async () => {
  const { libraryStateLabel, libraryStateMeaning } = await import("../src/library-state.ts");
  const labels = (["INDEXED", "AUDITED", "VERIFIED", "STORED_ON_0G"] as const).map(libraryStateLabel);
  // Four distinct labels — never merged, never reduced to a single badge.
  assert.equal(new Set(labels).size, 4);
  for (const id of ["INDEXED", "AUDITED", "VERIFIED", "STORED_ON_0G"] as const) {
    const meaning = libraryStateMeaning(id);
    assert.ok(meaning.length > 0, `${id} must carry a stated meaning, never a bare word`);
    assert.doesNotMatch(meaning, /safe(?! )/i);
  }
  // Each of the three strongest states states a limit in its own meaning text.
  assert.match(libraryStateMeaning("AUDITED"), /Not a safety guarantee/);
  assert.match(libraryStateMeaning("VERIFIED"), /Not a safety guarantee/);
  assert.match(libraryStateMeaning("STORED_ON_0G"), /Not a verdict/);
  assert.match(libraryStateMeaning("INDEXED"), /Not a verification/);
});

/**
 * PR 4/4 (ADR-018) additions: the FOR AGENTS page is the one surface that tells a *machine* what
 * AegisOne offers, so a wrong claim there is acted on rather than read. These assertions cover the
 * vocabulary and the script; `apps/web/test/agents-page.test.ts` covers set-equality with the live
 * server's registered tools.
 */

test("the advertised MCP tool list can never contain a Threat M8-018 denied primitive", async () => {
  const { ADVERTISED_MCP_TOOLS } = await import("../src/pages/agents.ts");
  const advertised = new Set<string>(ADVERTISED_MCP_TOOLS);
  for (const denied of ["aegisone_install", "aegisone_execute", "aegisone_sign", "aegisone_run_arbitrary_build", "aegisone_upload_secret"]) {
    assert.ok(!advertised.has(denied), `${denied} must never be advertised (docs/17 Threat M8-018)`);
  }
  // Read/policy vocabulary only: nothing that names a mutation, a build, a spend or a signature.
  for (const name of advertised) {
    assert.doesNotMatch(name, /install|execute|run|build|sign|upload|publish|write|deploy|spend/i, `${name} names a non-read primitive`);
  }
});

test("the FOR AGENTS page's inline script is a clipboard convenience and nothing else", async () => {
  const source = await readFile(fileURLToPath(new URL("../src/pages/agents.ts", import.meta.url)), "utf8");
  const script = source.match(/const COPY_SCRIPT = `([\s\S]*?)`;/)?.[1] ?? "";
  assert.ok(script.length > 0, "expected the copy-to-clipboard script to be present");
  // No network, no evaluation, no storage, no dynamic import — a copy button cannot become a
  // channel for anything else.
  for (const forbidden of [/\bfetch\s*\(/, /XMLHttpRequest/, /\beval\s*\(/, /new Function/, /import\s*\(/, /localStorage/, /document\.write/, /innerHTML/]) {
    assert.doesNotMatch(script, forbidden, `the copy script must not use ${forbidden}`);
  }
  // It reads only from elements this page rendered itself, and writes only to the clipboard.
  assert.match(script, /navigator\.clipboard\.writeText/);
});
