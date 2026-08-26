import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { GithubSourceAuthError } from "./errors.ts";

/**
 * OAuth `state` handling for the GitHub App user-authorization flow
 * (docs/14-source-authentication.md "OAuth/source-claim flow", docs/17-m8-security-boundaries.md
 * Threat M8-007).
 *
 * The state token is an HMAC-signed, base64url-encoded `{nonce, returnTo, exp}` payload. The
 * same token value is placed both in the `state` query parameter sent to GitHub and in a
 * short-lived `Secure`, `HttpOnly`, `SameSite=Lax` cookie set on the browser. On callback, the
 * caller (`apps/web`) must compare the query `state` against the cookie value (constant-time)
 * *before* calling `verifyOAuthState`, and must clear the cookie regardless of outcome — this
 * is what makes the token effectively single-use: once the cookie is cleared, the same query
 * `state` value can never again be matched against a cookie for that browser.
 *
 * A random attacker who never had access to the victim's cookie cannot forge a valid pair
 * (CSRF), and an expired token is rejected independent of cookie matching.
 */

export interface OAuthStatePayload {
  readonly nonce: string;
  readonly returnTo: string;
  readonly exp: number;
}

const DEFAULT_TTL_SECONDS = 600; // 10 minutes, within the 5-10 minute window required by docs/17.
const MIN_STATE_SECRET_LENGTH = 32;

function requireSecret(secret: string): void {
  if (secret.length < MIN_STATE_SECRET_LENGTH) {
    throw new Error(`GITHUB_OAUTH_STATE_SECRET must be at least ${MIN_STATE_SECRET_LENGTH} characters`);
  }
}

function sign(secret: string, payloadB64: string): string {
  return createHmac("sha256", secret).update(payloadB64).digest("base64url");
}

export function createOAuthState(secret: string, returnTo: string, ttlSeconds = DEFAULT_TTL_SECONDS): string {
  requireSecret(secret);
  const payload: OAuthStatePayload = {
    nonce: randomBytes(16).toString("base64url"),
    returnTo,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = sign(secret, payloadB64);
  return `${payloadB64}.${signature}`;
}

export function verifyOAuthState(secret: string, token: string): OAuthStatePayload {
  requireSecret(secret);
  const parts = token.split(".");
  if (parts.length !== 2) throw new GithubSourceAuthError("oauth_state_invalid", "malformed state token", 400);
  const [payloadB64, signature] = parts as [string, string];

  const expected = sign(secret, payloadB64);
  const actual = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actual.length !== expectedBuffer.length || !timingSafeEqual(actual, expectedBuffer)) {
    throw new GithubSourceAuthError("oauth_state_invalid", "state signature mismatch", 400);
  }

  let payload: OAuthStatePayload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    throw new GithubSourceAuthError("oauth_state_invalid", "state payload was not valid JSON", 400);
  }
  if (typeof payload.nonce !== "string" || typeof payload.returnTo !== "string" || typeof payload.exp !== "number") {
    throw new GithubSourceAuthError("oauth_state_invalid", "state payload missing required fields", 400);
  }
  if (Math.floor(Date.now() / 1000) > payload.exp) {
    throw new GithubSourceAuthError("oauth_state_expired", "state has expired", 400);
  }
  return payload;
}

/** Constant-time comparison for the query `state` vs. the cookie-stored state value. */
export function constantTimeStringEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

/** Only local, same-origin paths are accepted as `returnTo` (Threat M8-007: `returnTo`
 * must be validated against a local allowlist/path only, never an absolute/external URL). */
export function isSafeReturnTo(value: string): boolean {
  if (!value.startsWith("/")) return false;
  if (value.startsWith("//")) return false;
  if (value.includes("\\")) return false;
  try {
    // Resolve against a fixed dummy origin; reject if the parsed origin/host differs (i.e. the
    // value smuggled a scheme/host, e.g. "/\t/evil.com" or "/..%2f..").
    const resolved = new URL(value, "https://aegisone.local");
    return resolved.origin === "https://aegisone.local";
  } catch {
    return false;
  }
}
