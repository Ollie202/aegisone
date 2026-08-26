import { GithubSourceAuthError } from "./errors.ts";
import { normalizeCollaboratorPermission, normalizePermissionFlags } from "./permission.ts";
import type {
  GithubAuthenticatedUser,
  GithubCollaboratorPermission,
  GithubInstallation,
  GithubInstallationRepository,
  GithubRepository,
  GithubResolvedCommit,
  GithubSourceAuthConfig,
} from "./model.ts";

/**
 * Bounded GitHub REST client (docs/15-m8-api-inventory.md sections 5 and 6). Every call:
 * - is scoped to a fixed origin (`https://api.github.com` or `https://github.com`);
 * - has a strict timeout and a hard response-size cap;
 * - never follows redirects;
 * - never logs the Authorization header, request body, or response body verbatim
 *   (docs/17-m8-security-boundaries.md Threat M8-007 "token/code never logged").
 */

const GITHUB_API_BASE = "https://api.github.com";
const GITHUB_API_VERSION = "2026-03-10";
const TIMEOUT_MS = 5000;
const MAX_RESPONSE_BYTES = 1 * 1024 * 1024;
const MAX_INSTALLATIONS = 25;
const MAX_REPOSITORIES = 100;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

interface BoundedResult {
  readonly status: number;
  readonly body: unknown;
}

async function boundedRequest(
  url: string,
  init: RequestInit,
  fetcher: typeof fetch,
): Promise<BoundedResult> {
  const timeoutSignal = AbortSignal.timeout(TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetcher(url, { ...init, redirect: "manual", signal: timeoutSignal });
  } catch (error) {
    if (timeoutSignal.aborted) throw new GithubSourceAuthError("github_timeout", `request to ${new URL(url).host} timed out`);
    throw new GithubSourceAuthError("github_network_error", error instanceof Error ? error.message : String(error));
  }

  if (response.type === "opaqueredirect" || (response.status >= 300 && response.status < 400)) {
    throw new GithubSourceAuthError("github_malformed_response", "GitHub response was an unexpected redirect", 502);
  }

  const contentLength = response.headers.get("content-length");
  if (contentLength !== null) {
    const declared = Number(contentLength);
    if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) {
      throw new GithubSourceAuthError("github_response_too_large", "GitHub response exceeded the size limit", 502);
    }
  }

  if (response.body === null) return { status: response.status, body: null };

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > MAX_RESPONSE_BYTES) {
          throw new GithubSourceAuthError("github_response_too_large", "GitHub response exceeded the size limit", 502);
        }
        chunks.push(value);
      }
    }
  } finally {
    reader.releaseLock();
  }

  const text = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf8");
  if (text.length === 0) return { status: response.status, body: null };
  try {
    return { status: response.status, body: JSON.parse(text) };
  } catch {
    throw new GithubSourceAuthError("github_malformed_response", "GitHub response was not valid JSON", 502);
  }
}

function githubHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "x-github-api-version": GITHUB_API_VERSION,
    "user-agent": "aegisone-source-auth",
  };
  if (token) headers.authorization = `Bearer ${token}`;
  return headers;
}

export async function exchangeCodeForAccessToken(
  config: GithubSourceAuthConfig,
  code: string,
): Promise<{ readonly accessToken: string; readonly scope: string | null }> {
  const fetcher = config.fetcher ?? fetch;
  const { status, body } = await boundedRequest(
    "https://github.com/login/oauth/access_token",
    {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: config.callbackUrl,
      }),
    },
    fetcher,
  );
  if (status !== 200 || !isObject(body) || typeof body.access_token !== "string" || body.access_token.length === 0) {
    throw new GithubSourceAuthError("oauth_token_exchange_failed", "GitHub authorization code exchange failed", 502);
  }
  return { accessToken: body.access_token, scope: typeof body.scope === "string" ? body.scope : null };
}

export async function getAuthenticatedUser(token: string, fetcher: typeof fetch = fetch): Promise<GithubAuthenticatedUser> {
  const { status, body } = await boundedRequest(`${GITHUB_API_BASE}/user`, { headers: githubHeaders(token) }, fetcher);
  if (status !== 200 || !isObject(body) || typeof body.id !== "number" || typeof body.login !== "string") {
    throw new GithubSourceAuthError("github_user_lookup_failed", "could not resolve the authenticated GitHub user", status === 401 ? 401 : 502);
  }
  return { id: body.id, login: body.login };
}

export async function listUserInstallations(token: string, fetcher: typeof fetch = fetch): Promise<GithubInstallation[]> {
  const { status, body } = await boundedRequest(
    `${GITHUB_API_BASE}/user/installations?per_page=${MAX_INSTALLATIONS}`,
    { headers: githubHeaders(token) },
    fetcher,
  );
  if (status !== 200 || !isObject(body) || !Array.isArray(body.installations)) {
    throw new GithubSourceAuthError("github_installations_lookup_failed", "could not list GitHub App installations", 502);
  }
  return body.installations.slice(0, MAX_INSTALLATIONS).filter(isObject).map((installation) => ({
    id: typeof installation.id === "number" ? installation.id : -1,
    accountLogin: isObject(installation.account) && typeof installation.account.login === "string" ? installation.account.login : null,
    accountId: isObject(installation.account) && typeof installation.account.id === "number" ? installation.account.id : null,
  })).filter((installation) => installation.id !== -1);
}

function toInstallationRepository(entry: Record<string, unknown>): GithubInstallationRepository | null {
  if (typeof entry.id !== "number" || typeof entry.full_name !== "string" || !isObject(entry.owner)) return null;
  const owner = entry.owner;
  if (typeof owner.login !== "string" || typeof owner.id !== "number") return null;
  return {
    id: entry.id,
    nodeId: typeof entry.node_id === "string" ? entry.node_id : null,
    fullName: entry.full_name,
    ownerLogin: owner.login,
    ownerId: owner.id,
    isPrivate: entry.private === true,
    defaultBranch: typeof entry.default_branch === "string" ? entry.default_branch : "main",
    permission: normalizePermissionFlags(isObject(entry.permissions) ? entry.permissions as never : null),
  };
}

export async function listInstallationRepositories(
  token: string,
  installationId: number,
  fetcher: typeof fetch = fetch,
): Promise<GithubInstallationRepository[]> {
  const { status, body } = await boundedRequest(
    `${GITHUB_API_BASE}/user/installations/${installationId}/repositories?per_page=${MAX_REPOSITORIES}`,
    { headers: githubHeaders(token) },
    fetcher,
  );
  if (status !== 200 || !isObject(body) || !Array.isArray(body.repositories)) {
    throw new GithubSourceAuthError("github_installation_repositories_lookup_failed", "could not list installation repositories", 502);
  }
  const results: GithubInstallationRepository[] = [];
  for (const entry of body.repositories.slice(0, MAX_REPOSITORIES)) {
    if (!isObject(entry)) continue;
    const repo = toInstallationRepository(entry);
    if (repo) results.push(repo);
  }
  return results;
}

export async function getCollaboratorPermission(
  token: string,
  owner: string,
  repo: string,
  username: string,
  fetcher: typeof fetch = fetch,
): Promise<GithubCollaboratorPermission> {
  const { status, body } = await boundedRequest(
    `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/collaborators/${encodeURIComponent(username)}/permission`,
    { headers: githubHeaders(token) },
    fetcher,
  );
  if (status !== 200 || !isObject(body) || typeof body.permission !== "string") {
    throw new GithubSourceAuthError("github_permission_lookup_failed", "could not resolve effective repository permission", 502);
  }
  const roleName = typeof body.role_name === "string" ? body.role_name : null;
  return { permission: normalizeCollaboratorPermission(body.permission, roleName), roleName };
}

/** Public, unauthenticated-capable lookup: resolves the repository's stable identity
 * independent of any claimed owner/name text (docs/17 Threat M8-009). */
export async function getRepository(owner: string, repo: string, token?: string, fetcher: typeof fetch = fetch): Promise<GithubRepository> {
  const { status, body } = await boundedRequest(
    `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
    { headers: githubHeaders(token) },
    fetcher,
  );
  if (status === 404) throw new GithubSourceAuthError("github_repository_not_found", `repository ${owner}/${repo} was not found`, 404);
  if (status !== 200 || !isObject(body) || typeof body.id !== "number" || typeof body.full_name !== "string" || !isObject(body.owner)) {
    throw new GithubSourceAuthError("github_repository_not_found", `repository ${owner}/${repo} could not be resolved`, 502);
  }
  const ownerObject = body.owner;
  if (typeof ownerObject.login !== "string" || typeof ownerObject.id !== "number") {
    throw new GithubSourceAuthError("github_repository_not_found", "repository owner identity was malformed", 502);
  }
  return {
    id: body.id,
    nodeId: typeof body.node_id === "string" ? body.node_id : null,
    fullName: body.full_name,
    ownerLogin: ownerObject.login,
    ownerId: ownerObject.id,
    isPrivate: body.private === true,
    defaultBranch: typeof body.default_branch === "string" ? body.default_branch : "main",
  };
}

/** Independently resolves the exact 40-character commit SHA for `ref` (docs/14 Step 5: never
 * `main`/a branch/an unpinned tag as the recorded security-relevant source ref — the *ref
 * parameter* may be a branch/tag/short-sha, but only the resolved `sha` field is persisted). */
export async function getCommit(owner: string, repo: string, ref: string, token?: string, fetcher: typeof fetch = fetch): Promise<GithubResolvedCommit> {
  const { status, body } = await boundedRequest(
    `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits/${encodeURIComponent(ref)}`,
    { headers: githubHeaders(token) },
    fetcher,
  );
  if (status === 404) throw new GithubSourceAuthError("github_commit_not_found", `commit ${ref} was not found in ${owner}/${repo}`, 404);
  if (status !== 200 || !isObject(body) || typeof body.sha !== "string" || !/^[0-9a-f]{40}$/i.test(body.sha)) {
    throw new GithubSourceAuthError("github_commit_not_found", `commit ${ref} could not be resolved to an exact SHA`, 502);
  }
  return { sha: body.sha.toLowerCase() };
}
