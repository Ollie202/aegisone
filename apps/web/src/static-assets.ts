import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { ServerResponse } from "node:http";

/**
 * Serves the fixed, small set of static assets the M9 Hub client needs
 * (`apps/web/public/app.js` plus the isomorphic `apps/web/src/ui/*.mjs` render modules the
 * browser imports directly — see ADR-013). Deliberately a hardcoded allowlist of
 * `{ urlPath -> fileURL }`, never a general static-directory server: no path parameter is ever
 * used to construct a filesystem path, so there is no path-traversal surface here at all.
 */

const APP_JS_URL = new URL("../public/app.js", import.meta.url);
const UI_DIR_URL = new URL("../src/ui/", import.meta.url);

const UI_MODULES = ["escape.mjs", "badges.mjs", "result-card.mjs", "policy-result.mjs", "policy-form.mjs", "evidence-passport.mjs", "source-claim-view.mjs"];

const ASSETS = new Map<string, { fileUrl: URL; contentType: string }>([
  ["/static/app.js", { fileUrl: APP_JS_URL, contentType: "application/javascript; charset=utf-8" }],
  ...UI_MODULES.map((name): [string, { fileUrl: URL; contentType: string }] => [
    `/static/ui/${name}`,
    { fileUrl: new URL(name, UI_DIR_URL), contentType: "application/javascript; charset=utf-8" },
  ]),
]);

export function isStaticAssetPath(pathname: string): boolean {
  return ASSETS.has(pathname);
}

export async function serveStaticAsset(pathname: string, response: ServerResponse): Promise<boolean> {
  const asset = ASSETS.get(pathname);
  if (!asset) return false;
  try {
    const contents = await readFile(fileURLToPath(asset.fileUrl));
    response.writeHead(200, {
      "content-type": asset.contentType,
      // Static assets are versioned by deploy, not by content hash; avoid caching so a redeploy
      // is always immediately visible during the M9 judge-demo path.
      "cache-control": "no-store",
    });
    response.end(contents);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found\n");
  }
  return true;
}

// Only used by tests to assert the exact allowlist stays what's documented above.
export function listStaticAssetPaths(): string[] {
  return [...ASSETS.keys()];
}
