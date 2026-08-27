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
