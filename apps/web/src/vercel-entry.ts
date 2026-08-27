import type { IncomingMessage, ServerResponse } from "node:http";
import { createJobStoreFromEnv } from "../../../packages/job-store/src/index.ts";
import { createCatalogStoreFromEnv } from "../../../packages/catalog-store/src/index.ts";
import { createProductRequestHandler } from "./product.ts";

/**
 * Vercel serverless entrypoint for the exact same product surface `src/server.ts` serves on
 * Railway. This file is a *transport adapter only*: it constructs the same stores from the same
 * environment variables and delegates every request to the same `createProductRequestHandler`
 * dispatcher. No route, response shape, trust/evidence rule, or product behaviour is defined,
 * duplicated, or altered here — if this file and `src/server.ts` ever disagree about behaviour,
 * `src/server.ts` is the one that is right and this adapter is the bug.
 *
 * Why the file lives at `apps/web/src/` rather than the conventional root `api/` directory:
 * `src/static-assets.ts` resolves its asset allowlist with `new URL("../public/...",
 * import.meta.url)`. `@vercel/node` bundles the entrypoint to a file at the entrypoint's own
 * repo-relative path inside the lambda, so keeping the entrypoint next to `product.ts` keeps those
 * `import.meta.url`-relative asset paths resolving to the `includeFiles`-shipped
 * `apps/web/public/**` and `apps/web/src/ui/**` exactly as they do under plain `node`. `vercel.json`
 * routes every path here, matching how `server.ts` dispatches everything through one handler.
 *
 * Trust boundary (AGENTS.md / docs/17): this is the public, non-secret-bearing `aegisone-app`
 * surface only. The 0G signer (`ZEROG_STORAGE_PRIVATE_KEY`) and every other worker-side secret stay
 * exclusively on the `aegisone-worker` Railway service and are never present here.
 */

const store = createJobStoreFromEnv();

// Same deliberate degradation as `src/server.ts`: a missing/unconfigured Supabase catalog falls back
// to a non-persistent in-memory catalog store rather than crashing startup. Source-claim/discovery
// persistence is then explicitly unavailable — never silently faked.
let catalogStore;
try {
  catalogStore = createCatalogStoreFromEnv();
} catch (error) {
  process.stdout.write(
    `AegisOne catalog store unavailable, falling back to in-memory (non-persistent): ${error instanceof Error ? error.message : String(error)}\n`,
  );
}

const handler = createProductRequestHandler(store, { catalogStore });

export default async function vercelHandler(request: IncomingMessage, response: ServerResponse): Promise<void> {
  // Byte-for-byte the same last-resort error envelope `src/server.ts` emits.
  try {
    await handler(request, response);
  } catch (error) {
    response.writeHead(500, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
    response.end(`${JSON.stringify({ error: "internal_error", message: error instanceof Error ? error.message : String(error) })}\n`);
  }
}
