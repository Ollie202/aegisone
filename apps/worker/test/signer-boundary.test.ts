import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

/**
 * The architectural invariant this whole PR rests on: **only `aegisone-worker` holds the 0G
 * signer.** The public frontends — `aegisone-app` on Railway and the Vercel deployment, both of
 * which serve `apps/web` — must never read `ZEROG_STORAGE_PRIVATE_KEY`, never construct a 0G
 * signing transport, and never import the module that does.
 *
 * `apps/web/test/m9-frontend-security-audit.test.ts` already asserts the *browser-reachable* files
 * are clean. This asserts the far stronger, server-side property for the entire `apps/web` source
 * tree, which is what actually keeps the key off Vercel (AGENTS.md "no public endpoint may expose
 * the 0G signer or automatically spend 0G"; docs/17 Threat M8-006).
 */

const WEB_SRC = new URL("../../web/src/", import.meta.url);

async function collectSourceFiles(dirUrl: URL): Promise<string[]> {
  const entries = await readdir(dirUrl, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      files.push(...(await collectSourceFiles(new URL(`${entry.name}/`, dirUrl))));
    } else if (/\.(ts|mjs|js)$/.test(entry.name)) {
      files.push(fileURLToPath(new URL(entry.name, dirUrl)));
    }
  }
  return files;
}

/** Strips comments so the assertions test what the code *does*, not what it explains about itself —
 * several of these modules deliberately discuss the signer boundary in prose. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
}

test("no apps/web source file reads the 0G signer secret", async () => {
  const files = await collectSourceFiles(WEB_SRC);
  assert.ok(files.length > 10, "expected the apps/web source tree to be present");
  for (const file of files) {
    const code = codeOnly(await readFile(file, "utf8"));
    assert.doesNotMatch(code, /ZEROG_STORAGE_PRIVATE_KEY/, `${file} must not read the 0G signer key`);
    assert.doesNotMatch(code, /AEGISONE_REGISTRY_CONTRACT/, `${file} must not configure a chain write`);
  }
});

test("no apps/web source file imports a signing-capable 0G module", async () => {
  const files = await collectSourceFiles(WEB_SRC);
  for (const file of files) {
    const code = codeOnly(await readFile(file, "utf8"));
    // The SDK transport and the registry client are the two signing-capable modules. `apps/web`
    // may reference the *provider-independent* `evidence-publish` package (for its integrity
    // re-check) but never these.
    assert.doesNotMatch(code, /storage-0g\/src\/sdk\.ts/, `${file} must not import the signing storage transport`);
    assert.doesNotMatch(code, /registry-0g\/src\/client\.ts/, `${file} must not import the registry signer`);
    assert.doesNotMatch(code, /apps\/worker|worker\/src\/publish-config/, `${file} must not import worker-side signer construction`);
    assert.doesNotMatch(code, /\bnew ethers\.Wallet\b|\bnew Wallet\b/, `${file} must not construct a wallet`);
  }
});

test("apps/web may only use the provider-independent half of evidence-publish", async () => {
  const files = await collectSourceFiles(WEB_SRC);
  for (const file of files) {
    const code = codeOnly(await readFile(file, "utf8"));
    // `publish.ts` performs the actual upload/chain write. The app re-checks integrity; it never
    // publishes, so it must not import the publishing entry point.
    assert.doesNotMatch(code, /publishEvidenceBundle/, `${file} must not be able to start a publication`);
  }
});

test("the worker's signer construction lives in exactly one module", async () => {
  const workerSrc = new URL("../src/", import.meta.url);
  const files = await collectSourceFiles(workerSrc);
  const readers = files.filter((file) => file.endsWith("publish-config.ts"));
  assert.equal(readers.length, 1, "expected exactly one publish-config module");

  // `status.ts` reads the key's *presence* to report a boolean, and `server.ts` names it in a
  // startup error message. Neither obtains its value for use. What must be confined to
  // `publish-config.ts` is reading the value off an environment object, which is the only thing
  // that can put the key into a signer.
  const ENV_READ = /(?:process\.env|env)\s*(?:\.\s*ZEROG_STORAGE_PRIVATE_KEY|\[\s*["']ZEROG_STORAGE_PRIVATE_KEY["']\s*\])/;
  for (const file of files) {
    if (file.endsWith("publish-config.ts") || file.endsWith("status.ts")) continue;
    const code = codeOnly(await readFile(file, "utf8"));
    assert.doesNotMatch(code, ENV_READ, `${file} must not read the signer key from the environment`);
  }

  // And the signing transport itself is constructed in exactly one place.
  const constructors = [];
  for (const file of files) {
    if (/new ZeroGSdkTransport\b/.test(codeOnly(await readFile(file, "utf8")))) constructors.push(file);
  }
  assert.equal(constructors.length, 1, `the signing transport must be constructed once, found: ${constructors.join(", ")}`);
  assert.ok(constructors[0]!.endsWith("publish-config.ts"));
});
