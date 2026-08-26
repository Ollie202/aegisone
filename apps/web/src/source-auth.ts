import type { IncomingMessage, ServerResponse } from "node:http";
import {
  GithubSourceAuthError,
  InMemoryClaimSessionStore,
  buildCanonicalSourceClaim,
  computeSourceClaimDigest,
  constantTimeStringEqual,
  createOAuthState,
  exchangeCodeForAccessToken,
  getAuthenticatedUser,
  getCollaboratorPermission,
  getCommit,
  getRepository,
  hasSufficientRepositoryAuthority,
  isSafeReturnTo,
  listInstallationRepositories,
  listUserInstallations,
  verifyOAuthState,
  type CanonicalSourceClaimAuthority,
  type ClaimSession,
  type GithubSourceAuthConfig,
} from "../../../packages/source-auth-github/src/index.ts";
import type { CatalogStore } from "../../../packages/catalog-store/src/store.ts";
import type { NewSourceClaim, SourceAssuranceLevel, SourceClaimAuthorityObservationInput } from "../../../packages/catalog-store/src/model.ts";

/**
 * `GET /auth/github/start`, `GET /auth/github/callback`,
 * `GET /api/v1/source-auth/github/repositories`, `POST /api/v1/source-claims`,
 * `GET /api/v1/source-claims/:claimId` (docs/14-source-authentication.md,
 * docs/15-m8-api-inventory.md section "GitHub source auth / claims").
 *
 * This module never sees the GitHub App client secret at rest and never persists a GitHub
 * access token; both live only in `GithubSourceAuthConfig` (process env) and the process-local
 * `InMemoryClaimSessionStore` for the duration of a short claim session
 * (docs/17-m8-security-boundaries.md Threat M8-007).
 */

const OAUTH_STATE_COOKIE = "pr_gh_oauth_state";
const SESSION_COOKIE = "pr_gh_session";
const OAUTH_STATE_TTL_SECONDS = 600;
const SESSION_TTL_SECONDS = 600;
const MAX_CLAIM_BODY_BYTES = 16 * 1024;

class SourceAuthRequestError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "SourceAuthRequestError";
    this.code = code;
    this.status = status;
  }
}

export interface SourceAuthRouterOptions {
  githubConfig: GithubSourceAuthConfig | null;
  catalogStore: CatalogStore;
  sessionStore?: InMemoryClaimSessionStore;
  /** Set false only for local http development/tests; production must keep cookies Secure. */
  secureCookies?: boolean;
  /** Overridable for tests. Used for every direct GitHub REST call (repository/commit/permission
   * lookups), independent of whether `githubConfig` (the OAuth App config) is configured — the
   * DECLARED claim path calls the public GitHub API even with no GitHub App at all. */
  fetcher?: typeof fetch;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sendJson(response: ServerResponse, status: number, value: unknown, extraHeaders: Record<string, string | string[]> = {}): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extraHeaders });
  response.end(`${JSON.stringify(value)}\n`);
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) {
      try {
        out[key] = decodeURIComponent(value);
      } catch {
        out[key] = value;
      }
    }
  }
  return out;
}

function cookieHeader(name: string, value: string, maxAgeSeconds: number, secure: boolean): string {
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAgeSeconds}`];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

function clearCookieHeader(name: string, secure: boolean): string {
  return cookieHeader(name, "", 0, secure);
}

async function readJsonBody(request: IncomingMessage, limit = MAX_CLAIM_BODY_BYTES): Promise<unknown> {
  const contentLength = request.headers["content-length"];
  if (contentLength !== undefined) {
    const declared = Number(contentLength);
    if (!Number.isSafeInteger(declared) || declared < 0) throw new SourceAuthRequestError("invalid_request", "Invalid Content-Length header");
    if (declared > limit) throw new SourceAuthRequestError("request_too_large", `Request body exceeds the ${limit}-byte limit`, 413);
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > limit) throw new SourceAuthRequestError("request_too_large", `Request body exceeds the ${limit}-byte limit`, 413);
    chunks.push(buffer);
  }
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new SourceAuthRequestError("invalid_request", "Request body was not valid JSON");
  }
}

function requiredString(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  if (typeof value !== "string" || value.trim() === "") throw new SourceAuthRequestError("invalid_request", `${key} is required`);
  return value.trim();
}

function optionalString(body: Record<string, unknown>, key: string): string | null {
  const value = body[key];
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new SourceAuthRequestError("invalid_request", `${key} must be a string or null`);
  return value.trim();
}

function unavailableResponse(response: ServerResponse): void {
  sendJson(response, 503, {
    error: "github_source_auth_unavailable",
    message: "The GitHub App has not been configured on this deployment yet (GITHUB_APP_CLIENT_ID / "
      + "GITHUB_APP_CLIENT_SECRET / GITHUB_OAUTH_CALLBACK_URL / GITHUB_OAUTH_STATE_SECRET). DECLARED "
      + "source claims (without an authenticated GitHub authority) remain available.",
  });
}

function toGithubErrorResponse(response: ServerResponse, error: GithubSourceAuthError): void {
  sendJson(response, error.status >= 400 && error.status < 600 ? error.status : 502, { error: error.code, message: error.message });
}

export function createSourceAuthRouter(options: SourceAuthRouterOptions) {
  const sessionStore = options.sessionStore ?? new InMemoryClaimSessionStore();
  const secureCookies = options.secureCookies ?? true;
  const fetcher = options.fetcher ?? options.githubConfig?.fetcher ?? fetch;

  function getSession(request: IncomingMessage): ClaimSession | null {
    const cookies = parseCookies(request.headers.cookie);
    const sessionId = cookies[SESSION_COOKIE];
    if (!sessionId) return null;
    return sessionStore.get(sessionId);
  }

  async function handleStart(request: IncomingMessage, response: ServerResponse, url: URL, config: GithubSourceAuthConfig): Promise<void> {
    const returnTo = url.searchParams.get("returnTo") ?? "/";
    if (!isSafeReturnTo(returnTo)) {
      sendJson(response, 400, { error: "invalid_return_to", message: "returnTo must be a local path" });
      return;
    }
    const state = createOAuthState(config.stateSecret, returnTo, OAUTH_STATE_TTL_SECONDS);
    const authorizeUrl = new URL("https://github.com/login/oauth/authorize");
    authorizeUrl.searchParams.set("client_id", config.clientId);
    authorizeUrl.searchParams.set("redirect_uri", config.callbackUrl);
    authorizeUrl.searchParams.set("state", state);

    response.writeHead(302, {
      location: authorizeUrl.toString(),
      "set-cookie": cookieHeader(OAUTH_STATE_COOKIE, state, OAUTH_STATE_TTL_SECONDS, secureCookies),
      "cache-control": "no-store",
    });
    response.end();
  }

  async function handleCallback(request: IncomingMessage, response: ServerResponse, url: URL, config: GithubSourceAuthConfig): Promise<void> {
    // The state cookie is always cleared in the response, win or lose: this is what makes a
    // captured `state` query value unusable a second time against this browser session
    // (docs/17 Threat M8-007 single-use/replay protection).
    const clearStateCookie = clearCookieHeader(OAUTH_STATE_COOKIE, secureCookies);

    const code = url.searchParams.get("code");
    const stateParam = url.searchParams.get("state");
    if (!code || !stateParam) {
      sendJson(response, 400, { error: "invalid_request", message: "code and state are required" }, { "set-cookie": clearStateCookie });
      return;
    }

    const cookies = parseCookies(request.headers.cookie);
    const cookieState = cookies[OAUTH_STATE_COOKIE];
    if (!cookieState || !constantTimeStringEqual(cookieState, stateParam)) {
      sendJson(response, 400, { error: "oauth_state_invalid", message: "state does not match the browser session" }, { "set-cookie": clearStateCookie });
      return;
    }

    let payload;
    try {
      payload = verifyOAuthState(config.stateSecret, stateParam);
    } catch (error) {
      if (error instanceof GithubSourceAuthError) {
        sendJson(response, error.status, { error: error.code, message: error.message }, { "set-cookie": clearStateCookie });
        return;
      }
      throw error;
    }

    let accessToken: string;
    let user: { id: number; login: string };
    try {
      const exchange = await exchangeCodeForAccessToken(config, code);
      accessToken = exchange.accessToken;
      user = await getAuthenticatedUser(accessToken, fetcher);
    } catch (error) {
      if (error instanceof GithubSourceAuthError) {
        sendJson(response, error.status, { error: error.code, message: error.message }, { "set-cookie": clearStateCookie });
        return;
      }
      throw error;
    }

    const sessionId = sessionStore.create({ githubAccessToken: accessToken, githubUserId: user.id, githubLogin: user.login }, SESSION_TTL_SECONDS);
    const setCookies = [clearStateCookie, cookieHeader(SESSION_COOKIE, sessionId, SESSION_TTL_SECONDS, secureCookies)];

    if (payload.returnTo && payload.returnTo !== "") {
      response.writeHead(302, { location: payload.returnTo, "set-cookie": setCookies, "cache-control": "no-store" });
      response.end();
      return;
    }
    sendJson(response, 200, { authenticated: true, githubLogin: user.login, githubUserId: user.id }, { "set-cookie": setCookies });
  }

  async function handleListRepositories(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const session = getSession(request);
    if (!session) {
      sendJson(response, 401, { error: "source_auth_session_required", message: "Complete GET /auth/github/start first" });
      return;
    }
    const installations = await listUserInstallations(session.githubAccessToken, fetcher);
    const repositories = [];
    for (const installation of installations) {
      const repos = await listInstallationRepositories(session.githubAccessToken, installation.id, fetcher);
      for (const repo of repos) {
        repositories.push({
          repositoryId: repo.id,
          nodeId: repo.nodeId,
          fullName: repo.fullName,
          ownerLogin: repo.ownerLogin,
          ownerId: repo.ownerId,
          private: repo.isPrivate,
          defaultBranch: repo.defaultBranch,
          permission: repo.permission,
          sufficientAuthority: hasSufficientRepositoryAuthority(repo.permission),
          // Private-source independent reproduction is out of scope for M8 MVP
          // (docs/14 "Private repositories"): mark explicitly rather than silently attempting it.
          supported: !repo.isPrivate,
        });
      }
    }
    sendJson(response, 200, { githubLogin: session.githubLogin, repositories });
  }

  function parseCreateClaimBody(body: unknown): {
    resourceId: string;
    resourceVersionId: string;
    repositoryFullName: string;
    ref: string | null;
    subdirectory: string | null;
    distributionUrl: string | null;
    distributionSha256: string | null;
  } {
    if (!isObject(body)) throw new SourceAuthRequestError("invalid_request", "Request body must be a JSON object");
    const resourceId = requiredString(body, "resourceId");
    const resourceVersionId = requiredString(body, "resourceVersionId");
    const repositoryFullName = requiredString(body, "repositoryFullName");
    if (!/^[^/\s]+\/[^/\s]+$/.test(repositoryFullName)) {
      throw new SourceAuthRequestError("invalid_request", "repositoryFullName must be an exact owner/repo pair");
    }
    const ref = optionalString(body, "ref");
    const subdirectory = optionalString(body, "subdirectory");
    const distributionUrl = optionalString(body, "distributionUrl");
    if (distributionUrl) {
      let parsed: URL;
      try {
        parsed = new URL(distributionUrl);
      } catch {
        throw new SourceAuthRequestError("invalid_request", "distributionUrl must be an absolute URL");
      }
      if (parsed.protocol !== "https:") throw new SourceAuthRequestError("invalid_request", "distributionUrl must use https://");
    }
    const distributionSha256 = optionalString(body, "distributionSha256");
    if (distributionSha256 && !/^[0-9a-f]{64}$/i.test(distributionSha256)) {
      throw new SourceAuthRequestError("invalid_request", "distributionSha256 must be a 64-character SHA-256 digest");
    }
    return { resourceId, resourceVersionId, repositoryFullName, ref, subdirectory, distributionUrl, distributionSha256: distributionSha256?.toLowerCase() ?? null };
  }

  async function handleCreateSourceClaim(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const parsed = parseCreateClaimBody(await readJsonBody(request));
    const [owner, repo] = parsed.repositoryFullName.split("/") as [string, string];
    const session = getSession(request);

    let repository;
    try {
      repository = await getRepository(owner, repo, session?.githubAccessToken, fetcher);
    } catch (error) {
      if (error instanceof GithubSourceAuthError) {
        sendJson(response, error.status, { error: error.code, message: error.message });
        return;
      }
      throw error;
    }

    // Private-source independent verification is explicitly out of scope for the M8 MVP
    // (docs/14 "Private repositories"): reject rather than silently attempting it.
    if (repository.isPrivate) {
      sendJson(response, 400, { error: "private_repository_unsupported", message: "ProofRail source claims support public GitHub repositories only in M8" });
      return;
    }

    const ref = parsed.ref ?? repository.defaultBranch;
    let commit;
    try {
      commit = await getCommit(owner, repo, ref, session?.githubAccessToken, fetcher);
    } catch (error) {
      if (error instanceof GithubSourceAuthError) {
        sendJson(response, error.status, { error: error.code, message: error.message });
        return;
      }
      throw error;
    }

    let assuranceLevel: SourceAssuranceLevel = "DECLARED";
    let authenticatedAt: string | null = null;
    let authority: CanonicalSourceClaimAuthority | null = null;
    const authorityObservations: SourceClaimAuthorityObservationInput[] = [];

    if (session) {
      try {
        const permission = await getCollaboratorPermission(session.githubAccessToken, owner, repo, session.githubLogin, fetcher);
        const observedAt = new Date().toISOString();
        authorityObservations.push({
          provider: "github",
          subjectType: "github-user",
          subjectId: String(session.githubUserId),
          subjectLogin: session.githubLogin,
          repositoryId: repository.id,
          observedPermission: permission.permission,
          observedRoleName: permission.roleName,
          observationJson: { permission: permission.permission, roleName: permission.roleName },
          observedAt,
        });
        // Read-only/triage/unknown authority never upgrades assurance
        // (docs/14 Step 4, docs/17 Threat M8-008): the claim stays DECLARED.
        if (hasSufficientRepositoryAuthority(permission.permission)) {
          assuranceLevel = "REPOSITORY_AUTHENTICATED";
          authenticatedAt = observedAt;
          authority = { githubUserId: session.githubUserId, githubLogin: session.githubLogin, permission: permission.permission };
        }
      } catch {
        // Permission could not be confidently determined => do not upgrade
        // (docs/14 Step 4: "return source_authority_insufficient or source_auth_failed; do not
        // upgrade assurance"). The claim is still recorded, as DECLARED.
      }
    }

    const canonicalClaim = buildCanonicalSourceClaim({
      resourceId: parsed.resourceId,
      resourceVersionId: parsed.resourceVersionId,
      provider: "github",
      repository: { id: repository.id, fullName: repository.fullName },
      source: { commitSha: commit.sha, subdirectory: parsed.subdirectory },
      distribution: parsed.distributionUrl ? { url: parsed.distributionUrl, sha256: parsed.distributionSha256 } : null,
      authority,
    });
    const claimDigestSha256 = computeSourceClaimDigest(canonicalClaim);

    const newClaim: NewSourceClaim = {
      resourceVersionId: parsed.resourceVersionId,
      provider: "github",
      assuranceLevel,
      sourceRepository: repository.fullName,
      sourceRepositoryId: repository.id,
      sourceRepositoryNodeId: repository.nodeId,
      sourceOwnerLogin: repository.ownerLogin,
      sourceOwnerId: repository.ownerId,
      sourceCommitSha: commit.sha,
      sourceSubdirectory: parsed.subdirectory,
      distributionUrl: parsed.distributionUrl,
      distributionSha256: parsed.distributionSha256,
      claimDigestSha256,
      canonicalClaimJson: canonicalClaim,
      authenticatedAt,
      authorityObservations,
    };
    const result = await options.catalogStore.createSourceClaim(newClaim);
    sendJson(response, 201, result);
  }

  async function handleGetSourceClaim(response: ServerResponse, claimId: string): Promise<void> {
    const claim = await options.catalogStore.getSourceClaim(claimId);
    if (!claim) {
      sendJson(response, 404, { error: "source_claim_not_found" });
      return;
    }
    // Supabase is mutable; recompute/verify the digest before presenting authenticated source
    // evidence rather than trusting a stored row that could have been edited directly
    // (docs/16 "Critical invariant", docs/17 Threat M8-012).
    const recomputedDigest = computeSourceClaimDigest(claim.canonicalClaimJson);
    if (recomputedDigest !== claim.claimDigestSha256) {
      sendJson(response, 409, { error: "source_claim_integrity_check_failed", message: "stored claim digest no longer matches its canonical claim JSON" });
      return;
    }
    sendJson(response, 200, { claim, integrityVerified: true });
  }

  return async function handle(request: IncomingMessage, response: ServerResponse, url: URL): Promise<boolean> {
    try {
      if (request.method === "GET" && url.pathname === "/auth/github/start") {
        if (!options.githubConfig) return unavailableResponse(response), true;
        await handleStart(request, response, url, options.githubConfig);
        return true;
      }
      if (request.method === "GET" && url.pathname === "/auth/github/callback") {
        if (!options.githubConfig) return unavailableResponse(response), true;
        await handleCallback(request, response, url, options.githubConfig);
        return true;
      }
      if (request.method === "GET" && url.pathname === "/api/v1/source-auth/github/repositories") {
        if (!options.githubConfig) return unavailableResponse(response), true;
        await handleListRepositories(request, response);
        return true;
      }
      if (request.method === "POST" && url.pathname === "/api/v1/source-claims") {
        await handleCreateSourceClaim(request, response);
        return true;
      }
      const claimMatch = url.pathname.match(/^\/api\/v1\/source-claims\/([0-9a-fA-F-]+)$/);
      if (request.method === "GET" && claimMatch) {
        await handleGetSourceClaim(response, claimMatch[1]!);
        return true;
      }
      return false;
    } catch (error) {
      if (error instanceof SourceAuthRequestError) {
        sendJson(response, error.status, { error: error.code, message: error.message });
        return true;
      }
      if (error instanceof GithubSourceAuthError) {
        toGithubErrorResponse(response, error);
        return true;
      }
      throw error;
    }
  };
}
