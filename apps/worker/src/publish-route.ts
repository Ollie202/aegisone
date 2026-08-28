import { createHash, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  parsePublishEvidenceRequest,
  publishEvidenceBundle,
  PublishRequestError,
  MAX_PUBLISH_REQUEST_BYTES,
  type PublishEvidenceResult,
  type RegistryWriter,
} from "../../../packages/evidence-publish/src/index.ts";
import type { StorageTransport } from "../../../packages/storage-0g/src/types.ts";

/**
 * ============================================================================================
 * THE ONLY ROUTE IN AEGISONE THAT CAN SPEND 0G
 * ============================================================================================
 * `aegisone-worker` is the sole holder of `ZEROG_STORAGE_PRIVATE_KEY` in the entire system. The
 * public frontends (`aegisone-app` on Railway and the Vercel deployment) never have it, and
 * `apps/web/test/m9-frontend-security-audit.test.ts` asserts no browser-reachable file even
 * mentions it. This module is therefore written to the rules in AGENTS.md ("no public generic
 * worker execution/signing route") and docs/17-m8-security-boundaries.md (Threat M8-005 spend
 * abuse, Threat M8-006 signer/key exposure):
 *
 *   1. FAIL CLOSED WHEN UNCONFIGURED. If `AEGISONE_WORKER_INTERNAL_TOKEN` is unset, the route does
 *      not exist — requests to it get the same 404 as any other unknown path, exactly like the
 *      GitHub App integration's absent-when-unconfigured behaviour. There is no "insecure default",
 *      no dev bypass, and no way to enable it implicitly.
 *   2. SHARED-SECRET AUTH, COMPARED IN CONSTANT TIME. Both sides are SHA-256'd to fixed length
 *      first so `timingSafeEqual` cannot throw on a length mismatch and length itself does not
 *      leak. A missing or wrong token is a flat 401 that reveals nothing about the token.
 *   3. BOUNDED, VALIDATED PAYLOAD ONLY. The body is size-capped before parsing and then run
 *      through `parsePublishEvidenceRequest`, whose accepted key set is closed. There is no field
 *      for bytes-to-sign, calldata, a destination address, a contract, a command, or a URL. The
 *      worst a fully-authenticated caller can do is publish a size-capped evidence bundle and
 *      commit two digests to the pinned registry contract.
 *   4. NOTHING ELSE IS EXPOSED. `/health` keeps its exact prior behaviour and no other route is
 *      added, so the worker's public surface is unchanged for every unauthenticated caller.
 *
 * The token is never logged, never echoed, and never included in an error body.
 */

export interface PublishRouteConfig {
  /** SHA-256 hex digest of the shared internal token. Derived at startup from
   * `AEGISONE_WORKER_INTERNAL_TOKEN`; the raw token is never retained. */
  readonly expectedTokenSha256: string;
  readonly storage: StorageTransport;
  readonly network: { readonly network: string; readonly chainId: number };
  readonly registry: RegistryWriter | null;
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/** Constant-time comparison over equal-length digests. Hashing first means a length difference in
 * the raw tokens never reaches `timingSafeEqual` (which throws on unequal lengths) and never leaks
 * through timing. */
export function constantTimeTokenMatches(providedToken: string | null, expectedTokenSha256: string): boolean {
  if (providedToken === null || providedToken.length === 0) return false;
  if (!/^[0-9a-f]{64}$/i.test(expectedTokenSha256)) return false;
  const provided = Buffer.from(sha256Hex(providedToken), "hex");
  const expected = Buffer.from(expectedTokenSha256.toLowerCase(), "hex");
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

/** Extracts the bearer token from the Authorization header. Returns `null` for any other scheme. */
export function bearerToken(request: IncomingMessage): string | null {
  const header = request.headers.authorization;
  if (typeof header !== "string") return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1]!.trim() : null;
}

async function readBoundedBody(request: IncomingMessage, limit: number): Promise<unknown> {
  const declared = request.headers["content-length"];
  if (declared !== undefined) {
    const length = Number(declared);
    if (!Number.isSafeInteger(length) || length < 0) throw new PublishRequestError("invalid_request", "invalid Content-Length");
    if (length > limit) throw new PublishRequestError("request_too_large", "request body exceeds the limit");
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > limit) throw new PublishRequestError("request_too_large", "request body exceeds the limit");
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new PublishRequestError("invalid_request", "request body was not valid JSON");
  }
}

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(`${JSON.stringify(value)}\n`);
}

export interface PublishResponseBody {
  readonly ok: true;
  readonly resourceVersionId: string;
  readonly canonicalEvidenceSha256: string;
  readonly storage: { readonly network: string; readonly chainId: number; readonly root: string; readonly transaction: string };
  readonly registry: { readonly contract: string; readonly recordId: string; readonly transaction: string } | null;
  /** Present when the optional chain commitment was attempted and failed. The storage evidence
   * above is real and complete regardless; the caller persists both facts as they actually are. */
  readonly registryError: string | null;
  readonly bundleByteLength: number;
}

/**
 * Handles `POST /internal/publish-evidence`. Returns `true` when it handled the request (so the
 * server stops), `false` when the request was not for this route.
 *
 * Note the order of checks: method/path first, then auth, then body. Authentication is required
 * before a single byte of the body is read, so an unauthenticated caller cannot make the worker
 * allocate memory for a large payload.
 */
export async function handlePublishEvidence(
  request: IncomingMessage,
  response: ServerResponse,
  config: PublishRouteConfig,
): Promise<boolean> {
  const url = new URL(request.url ?? "/", "http://worker.invalid");
  if (url.pathname !== "/internal/publish-evidence") return false;

  if (request.method !== "POST") {
    sendJson(response, 405, { error: "method_not_allowed" });
    return true;
  }

  if (!constantTimeTokenMatches(bearerToken(request), config.expectedTokenSha256)) {
    // Deliberately uninformative: no hint about whether the token was absent, malformed or wrong.
    sendJson(response, 401, { error: "unauthorized" });
    return true;
  }

  let parsed: ReturnType<typeof parsePublishEvidenceRequest>;
  try {
    const body = await readBoundedBody(request, MAX_PUBLISH_REQUEST_BYTES);
    parsed = parsePublishEvidenceRequest(body);
  } catch (error) {
    if (error instanceof PublishRequestError) {
      sendJson(response, error.code === "request_too_large" ? 413 : 400, { error: error.code, message: error.message });
      return true;
    }
    sendJson(response, 400, { error: "invalid_request" });
    return true;
  }

  let result: PublishEvidenceResult;
  try {
    result = await publishEvidenceBundle(parsed.bundle, {
      storage: config.storage,
      network: config.network,
      registry: config.registry,
    });
  } catch (error) {
    // 0G-side failure. Reported as an explicit failure — never a partial or synthesised success,
    // and never a fabricated root (AGENTS.md: missing evidence stays missing).
    sendJson(response, 502, {
      error: "publication_failed",
      message: error instanceof Error ? error.message : String(error),
    });
    return true;
  }

  const body: PublishResponseBody = {
    ok: true,
    resourceVersionId: parsed.resourceVersionId,
    canonicalEvidenceSha256: result.canonicalEvidenceSha256,
    storage: {
      network: result.storage.network,
      chainId: result.storage.chainId,
      root: result.storage.root,
      transaction: result.storage.transaction,
    },
    registry: result.registry,
    registryError: result.registryError,
    bundleByteLength: result.bundleByteLength,
  };
  sendJson(response, 200, body);
  return true;
}
