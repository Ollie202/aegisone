import { randomBytes } from "node:crypto";

/**
 * Short-lived server-side transient store for the GitHub App user access token obtained during
 * the OAuth callback (docs/14-source-authentication.md: "do not store GitHub user access tokens
 * in Supabase after the short claim/session window"; docs/17 Threat M8-007 "no plaintext token
 * persistence"). The session id (not the token) is placed in a `Secure`, `HttpOnly`,
 * `SameSite=Lax` cookie; the token itself never reaches the browser or any database.
 *
 * This is intentionally process-local (matches the current single-instance `proofrail-app`
 * topology). If `proofrail-app` is ever scaled horizontally, this must move to a shared,
 * still-server-only, still-non-persistent store (e.g. Redis) rather than Supabase.
 */
export interface ClaimSession {
  readonly githubAccessToken: string;
  readonly githubUserId: number;
  readonly githubLogin: string;
  readonly createdAt: number;
  readonly expiresAt: number;
}

const DEFAULT_TTL_SECONDS = 600;

export class InMemoryClaimSessionStore {
  #sessions = new Map<string, ClaimSession>();

  create(session: { githubAccessToken: string; githubUserId: number; githubLogin: string }, ttlSeconds = DEFAULT_TTL_SECONDS): string {
    const id = randomBytes(32).toString("base64url");
    const now = Date.now();
    this.#sessions.set(id, { ...session, createdAt: now, expiresAt: now + ttlSeconds * 1000 });
    return id;
  }

  get(id: string): ClaimSession | null {
    const session = this.#sessions.get(id);
    if (!session) return null;
    if (Date.now() > session.expiresAt) {
      this.#sessions.delete(id);
      return null;
    }
    return session;
  }

  delete(id: string): void {
    this.#sessions.delete(id);
  }

  /** Test/ops helper: current live session count. */
  size(): number {
    return this.#sessions.size;
  }
}
