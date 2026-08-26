import type { GithubSourceAuthConfig } from "./model.ts";

const MIN_STATE_SECRET_LENGTH = 32;

/**
 * Builds the GitHub source-auth config from environment variables, or returns `null` if the
 * GitHub App has not been created/configured yet. This environment currently has no GitHub App
 * (`GITHUB_APP_CLIENT_ID`/`GITHUB_APP_CLIENT_SECRET`/`GITHUB_OAUTH_CALLBACK_URL`/
 * `GITHUB_OAUTH_STATE_SECRET` do not exist anywhere), so callers must treat `null` as "GitHub
 * source authentication is unavailable" rather than throwing — the rest of ProofRail (search,
 * DECLARED claims, read APIs) must keep working without it.
 */
export function createGithubSourceAuthConfigFromEnv(env: NodeJS.ProcessEnv = process.env): GithubSourceAuthConfig | null {
  const clientId = env.GITHUB_APP_CLIENT_ID?.trim();
  const clientSecret = env.GITHUB_APP_CLIENT_SECRET?.trim();
  const callbackUrl = env.GITHUB_OAUTH_CALLBACK_URL?.trim();
  const stateSecret = env.GITHUB_OAUTH_STATE_SECRET?.trim();
  if (!clientId || !clientSecret || !callbackUrl || !stateSecret) return null;
  if (stateSecret.length < MIN_STATE_SECRET_LENGTH) {
    throw new Error(`GITHUB_OAUTH_STATE_SECRET must be at least ${MIN_STATE_SECRET_LENGTH} characters`);
  }
  let parsedCallback: URL;
  try {
    parsedCallback = new URL(callbackUrl);
  } catch {
    throw new Error("GITHUB_OAUTH_CALLBACK_URL must be an absolute URL");
  }
  if (parsedCallback.protocol !== "https:" && parsedCallback.hostname !== "localhost") {
    throw new Error("GITHUB_OAUTH_CALLBACK_URL must use https:// outside local development");
  }
  const appSlug = env.GITHUB_APP_SLUG?.trim();
  return { clientId, clientSecret, appSlug: appSlug && appSlug.length > 0 ? appSlug : null, callbackUrl, stateSecret };
}
