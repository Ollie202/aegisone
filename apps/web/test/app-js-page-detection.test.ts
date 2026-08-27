import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("public app.js never relies on document.currentScript (always null for type=module scripts)", async () => {
  const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  assert.ok(
    !/document\.currentScript\??\.\w/.test(source),
    "document.currentScript is always null for <script type=\"module\">, so any page-detection logic " +
      "relying on it silently disables every client-side handler (e.g. the Connect GitHub button) " +
      "without throwing — see apps/web/src/pages/*.ts for the `data-page` attribute this must read instead.",
  );
  assert.match(source, /querySelector\(['"]script\[src="\/static\/app\.js"\]['"]\)\?\.dataset\.page/);
});
