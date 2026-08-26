import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { test } from "node:test";
import { InMemoryJobStore } from "../../../packages/job-store/src/index.ts";
import { InMemoryCatalogStore } from "../../../packages/catalog-store/src/index.ts";
import { createOAuthState } from "../../../packages/source-auth-github/src/index.ts";
import type { GithubSourceAuthConfig } from "../../../packages/source-auth-github/src/index.ts";
import { createProductRequestHandler } from "../src/product.ts";

const STATE_SECRET = "s".repeat(40);
const GITHUB_CONFIG_BASE = {
  clientId: "test-client-id",
  clientSecret: "test-client-secret",
  appSlug: "aegisone-source-verifier",
  callbackUrl: "http://127.0.0.1/auth/github/callback",
  stateSecret: STATE_SECRET,
};

interface Repo {
  id: number;
  nodeId: string;
  fullName: string;
  ownerLogin: string;
  ownerId: number;
  isPrivate: boolean;
  defaultBranch: string;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/** Deterministic fake GitHub backend keyed by fixed fixtures rather than live network calls. */
function makeFakeGithub(options: {
  repos: Record<string, Repo>;
  permissionFor?: Record<string, { permission: string; role_name: string }>;
  installations?: { id: number; repositories: Repo[] }[];
} = { repos: {} }) {
  const repos = options.repos;
  const permissions = options.permissionFor ?? {};
  const installations = options.installations ?? [];
  const fetcher = (async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url === "https://github.com/login/oauth/access_token") {
      return jsonResponse(200, { access_token: "ghu_test_token", scope: "" });
    }
    if (url === "https://api.github.com/user") {
      return jsonResponse(200, { id: 42, login: "octocat" });
    }
    if (url.startsWith("https://api.github.com/user/installations?")) {
      return jsonResponse(200, { installations: installations.map((i) => ({ id: i.id, account: { login: "acme", id: 900 } })) });
    }
    const installationReposMatch = url.match(/^https:\/\/api\.github\.com\/user\/installations\/(\d+)\/repositories/);
    if (installationReposMatch) {
      const installation = installations.find((i) => i.id === Number(installationReposMatch[1]));
      const list = installation?.repositories ?? [];
      return jsonResponse(200, {
        repositories: list.map((repo) => ({
          id: repo.id,
          node_id: repo.nodeId,
          full_name: repo.fullName,
          owner: { login: repo.ownerLogin, id: repo.ownerId },
          private: repo.isPrivate,
          default_branch: repo.defaultBranch,
          permissions: { admin: false, maintain: false, push: true, triage: true, pull: true },
        })),
      });
    }
    const repoMatch = url.match(/^https:\/\/api\.github\.com\/repos\/([^/]+)\/([^/]+)$/);
    if (repoMatch) {
      const fullName = `${repoMatch[1]}/${repoMatch[2]}`;
      const repo = repos[fullName];
      if (!repo) return jsonResponse(404, { message: "Not Found" });
      return jsonResponse(200, {
        id: repo.id,
        node_id: repo.nodeId,
        full_name: repo.fullName,
        owner: { login: repo.ownerLogin, id: repo.ownerId },
        private: repo.isPrivate,
        default_branch: repo.defaultBranch,
      });
    }
    const commitMatch = url.match(/^https:\/\/api\.github\.com\/repos\/([^/]+)\/([^/]+)\/commits\/(.+)$/);
    if (commitMatch) {
      const fullName = `${commitMatch[1]}/${commitMatch[2]}`;
      if (!repos[fullName]) return jsonResponse(404, { message: "Not Found" });
      return jsonResponse(200, { sha: "a".repeat(40) });
    }
    const permissionMatch = url.match(/^https:\/\/api\.github\.com\/repos\/([^/]+)\/([^/]+)\/collaborators\/([^/]+)\/permission$/);
    if (permissionMatch) {
      const key = `${permissionMatch[1]}/${permissionMatch[2]}`;
      const permission = permissions[key] ?? { permission: "read", role_name: "read" };
      return jsonResponse(200, permission);
    }
    return jsonResponse(404, { message: "unhandled fake GitHub route", url });
  }) as typeof fetch;
  return fetcher;
}

interface TestServer {
  baseUrl: string;
  server: Server;
  catalogStore: InMemoryCatalogStore;
}

async function startTestServer(options: { githubConfig?: GithubSourceAuthConfig | null; fetcher?: typeof fetch } = {}): Promise<TestServer> {
  const catalogStore = new InMemoryCatalogStore();
  const handler = createProductRequestHandler(new InMemoryJobStore(), {
    publicBaseUrl: "https://aegisone.example",
    catalogStore,
    githubSourceAuthConfig: options.githubConfig !== undefined ? options.githubConfig : null,
    githubFetcher: options.fetcher,
    secureSourceAuthCookies: false,
  });
  const server = createServer((request, response) => {
    void handler(request, response).catch((error) => {
      response.writeHead(500, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "internal_error", message: String(error) }));
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("Test server did not bind a TCP port");
  return { baseUrl: `http://127.0.0.1:${address.port}`, server, catalogStore };
}

async function stopTestServer(server: Server): Promise<void> {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

function extractCookie(response: Response, name: string): string {
  const raw = response.headers.get("set-cookie") ?? "";
  const match = raw.match(new RegExp(`${name}=([^;]+)`));
  if (!match) throw new Error(`cookie ${name} not present in response`);
  return `${name}=${match[1]}`;
}

test("GET /auth/github/start returns 503 when the GitHub App is not configured", async () => {
  const running = await startTestServer();
  try {
    const response = await fetch(`${running.baseUrl}/auth/github/start`, { redirect: "manual" });
    assert.equal(response.status, 503);
    const body = await response.json() as { error: string };
    assert.equal(body.error, "github_source_auth_unavailable");
  } finally {
    await stopTestServer(running.server);
  }
});

test("GET /auth/github/start redirects to GitHub with a signed state and sets an HttpOnly cookie", async () => {
  const githubConfig: GithubSourceAuthConfig = { ...GITHUB_CONFIG_BASE };
  const running = await startTestServer({ githubConfig });
  try {
    const response = await fetch(`${running.baseUrl}/auth/github/start?returnTo=/source/claim`, { redirect: "manual" });
    assert.equal(response.status, 302);
    const location = new URL(response.headers.get("location")!);
    assert.equal(location.origin, "https://github.com");
    assert.equal(location.pathname, "/login/oauth/authorize");
    assert.equal(location.searchParams.get("client_id"), githubConfig.clientId);
    assert.ok(location.searchParams.get("state"));
    const setCookie = response.headers.get("set-cookie") ?? "";
    assert.match(setCookie, /pr_gh_oauth_state=/);
    assert.match(setCookie, /HttpOnly/);
    assert.match(setCookie, /SameSite=Lax/);
  } finally {
    await stopTestServer(running.server);
  }
});

test("GET /auth/github/start rejects an external returnTo (open-redirect protection)", async () => {
  const githubConfig: GithubSourceAuthConfig = { ...GITHUB_CONFIG_BASE };
  const running = await startTestServer({ githubConfig });
  try {
    const response = await fetch(`${running.baseUrl}/auth/github/start?returnTo=https://evil.example`, { redirect: "manual" });
    assert.equal(response.status, 400);
  } finally {
    await stopTestServer(running.server);
  }
});

test("GET /auth/github/callback rejects a state that does not match the browser cookie", async () => {
  const githubConfig: GithubSourceAuthConfig = { ...GITHUB_CONFIG_BASE };
  const running = await startTestServer({ githubConfig, fetcher: makeFakeGithub() });
  try {
    const forgedState = createOAuthState(STATE_SECRET, "/source/claim");
    const response = await fetch(`${running.baseUrl}/auth/github/callback?code=abc&state=${forgedState}`, {
      redirect: "manual",
      headers: { cookie: "pr_gh_oauth_state=different-cookie-value" },
    });
    assert.equal(response.status, 400);
    const body = await response.json() as { error: string };
    assert.equal(body.error, "oauth_state_invalid");
  } finally {
    await stopTestServer(running.server);
  }
});

test("GET /auth/github/callback rejects an expired state even when the cookie matches", async () => {
  const githubConfig: GithubSourceAuthConfig = { ...GITHUB_CONFIG_BASE };
  const running = await startTestServer({ githubConfig, fetcher: makeFakeGithub() });
  try {
    const expiredState = createOAuthState(STATE_SECRET, "/source/claim", -10);
    const response = await fetch(`${running.baseUrl}/auth/github/callback?code=abc&state=${expiredState}`, {
      redirect: "manual",
      headers: { cookie: `pr_gh_oauth_state=${expiredState}` },
    });
    assert.equal(response.status, 400);
    const body = await response.json() as { error: string };
    assert.equal(body.error, "oauth_state_expired");
  } finally {
    await stopTestServer(running.server);
  }
});

test("full OAuth round trip establishes a session that authenticates repository listing and REPOSITORY_AUTHENTICATED claims", async () => {
  const repo: Repo = { id: 555, nodeId: "R_kgAA", fullName: "acme/auditor", ownerLogin: "acme", ownerId: 900, isPrivate: false, defaultBranch: "main" };
  const fetcher = makeFakeGithub({
    repos: { "acme/auditor": repo },
    permissionFor: { "acme/auditor": { permission: "write", role_name: "write" } },
    installations: [{ id: 1, repositories: [repo] }],
  });
  const githubConfig: GithubSourceAuthConfig = { ...GITHUB_CONFIG_BASE, fetcher };
  const running = await startTestServer({ githubConfig, fetcher });
  try {
    const startResponse = await fetch(`${running.baseUrl}/auth/github/start?returnTo=/source/claim`, { redirect: "manual" });
    const stateCookie = extractCookie(startResponse, "pr_gh_oauth_state");
    const state = new URL(startResponse.headers.get("location")!).searchParams.get("state")!;

    const callbackResponse = await fetch(`${running.baseUrl}/auth/github/callback?code=fake-code&state=${state}`, {
      redirect: "manual",
      headers: { cookie: stateCookie },
    });
    assert.equal(callbackResponse.status, 302);
    assert.equal(callbackResponse.headers.get("location"), "/source/claim");
    const sessionCookie = extractCookie(callbackResponse, "pr_gh_session");

    const reposResponse = await fetch(`${running.baseUrl}/api/v1/source-auth/github/repositories`, { headers: { cookie: sessionCookie } });
    assert.equal(reposResponse.status, 200);
    const reposBody = await reposResponse.json() as { repositories: { fullName: string; sufficientAuthority: boolean; supported: boolean }[] };
    assert.equal(reposBody.repositories.length, 1);
    assert.equal(reposBody.repositories[0]?.fullName, "acme/auditor");
    assert.equal(reposBody.repositories[0]?.sufficientAuthority, true);
    assert.equal(reposBody.repositories[0]?.supported, true);

    const claimResponse = await fetch(`${running.baseUrl}/api/v1/source-claims`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: sessionCookie },
      body: JSON.stringify({
        resourceId: "11111111-1111-1111-1111-111111111111",
        resourceVersionId: "22222222-2222-2222-2222-222222222222",
        repositoryFullName: "acme/auditor",
      }),
    });
    assert.equal(claimResponse.status, 201);
    const claimBody = await claimResponse.json() as { claim: { assuranceLevel: string; sourceCommitSha: string } };
    assert.equal(claimBody.claim.assuranceLevel, "REPOSITORY_AUTHENTICATED");
    assert.equal(claimBody.claim.sourceCommitSha, "a".repeat(40));
  } finally {
    await stopTestServer(running.server);
  }
});

test("read-only authority never upgrades a claim, even with a valid session", async () => {
  const repo: Repo = { id: 555, nodeId: "R_kgAA", fullName: "acme/auditor", ownerLogin: "acme", ownerId: 900, isPrivate: false, defaultBranch: "main" };
  const fetcher = makeFakeGithub({ repos: { "acme/auditor": repo }, permissionFor: { "acme/auditor": { permission: "read", role_name: "read" } } });
  const githubConfig: GithubSourceAuthConfig = { ...GITHUB_CONFIG_BASE, fetcher };
  const running = await startTestServer({ githubConfig, fetcher });
  try {
    const startResponse = await fetch(`${running.baseUrl}/auth/github/start?returnTo=/x`, { redirect: "manual" });
    const stateCookie = extractCookie(startResponse, "pr_gh_oauth_state");
    const state = new URL(startResponse.headers.get("location")!).searchParams.get("state")!;
    const callbackResponse = await fetch(`${running.baseUrl}/auth/github/callback?code=fake-code&state=${state}`, {
      redirect: "manual",
      headers: { cookie: stateCookie },
    });
    const sessionCookie = extractCookie(callbackResponse, "pr_gh_session");

    const claimResponse = await fetch(`${running.baseUrl}/api/v1/source-claims`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: sessionCookie },
      body: JSON.stringify({
        resourceId: "11111111-1111-1111-1111-111111111111",
        resourceVersionId: "22222222-2222-2222-2222-222222222222",
        repositoryFullName: "acme/auditor",
      }),
    });
    assert.equal(claimResponse.status, 201);
    const claimBody = await claimResponse.json() as { claim: { assuranceLevel: string } };
    assert.equal(claimBody.claim.assuranceLevel, "DECLARED");
  } finally {
    await stopTestServer(running.server);
  }
});

test("an unauthenticated caller (no session) always gets DECLARED, never REPOSITORY_AUTHENTICATED", async () => {
  const repo: Repo = { id: 555, nodeId: "R_kgAA", fullName: "acme/auditor", ownerLogin: "acme", ownerId: 900, isPrivate: false, defaultBranch: "main" };
  const fetcher = makeFakeGithub({ repos: { "acme/auditor": repo } });
  const running = await startTestServer({ githubConfig: null, fetcher });
  try {
    const claimResponse = await fetch(`${running.baseUrl}/api/v1/source-claims`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        resourceId: "11111111-1111-1111-1111-111111111111",
        resourceVersionId: "22222222-2222-2222-2222-222222222222",
        repositoryFullName: "acme/auditor",
      }),
    });
    assert.equal(claimResponse.status, 201);
    const claimBody = await claimResponse.json() as { claim: { assuranceLevel: string } };
    assert.equal(claimBody.claim.assuranceLevel, "DECLARED");
  } finally {
    await stopTestServer(running.server);
  }
});

test("a private repository is rejected explicitly rather than silently claimed", async () => {
  const repo: Repo = { id: 777, nodeId: "R_priv", fullName: "acme/secret", ownerLogin: "acme", ownerId: 900, isPrivate: true, defaultBranch: "main" };
  const fetcher = makeFakeGithub({ repos: { "acme/secret": repo } });
  const running = await startTestServer({ githubConfig: null, fetcher });
  try {
    const claimResponse = await fetch(`${running.baseUrl}/api/v1/source-claims`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        resourceId: "11111111-1111-1111-1111-111111111111",
        resourceVersionId: "22222222-2222-2222-2222-222222222222",
        repositoryFullName: "acme/secret",
      }),
    });
    assert.equal(claimResponse.status, 400);
    const body = await claimResponse.json() as { error: string };
    assert.equal(body.error, "private_repository_unsupported");
  } finally {
    await stopTestServer(running.server);
  }
});

test("a random unresolvable repository never becomes a claim at all", async () => {
  const running = await startTestServer({ githubConfig: null, fetcher: makeFakeGithub({ repos: {} }) });
  try {
    const claimResponse = await fetch(`${running.baseUrl}/api/v1/source-claims`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        resourceId: "11111111-1111-1111-1111-111111111111",
        resourceVersionId: "22222222-2222-2222-2222-222222222222",
        repositoryFullName: "nobody/does-not-exist",
      }),
    });
    assert.equal(claimResponse.status, 404);
    const body = await claimResponse.json() as { error: string };
    assert.equal(body.error, "github_repository_not_found");
  } finally {
    await stopTestServer(running.server);
  }
});

test("a second claim for a different repository on the same resource version is an explicit SOURCE_CLAIM_CONFLICT", async () => {
  const repoA: Repo = { id: 555, nodeId: "R_a", fullName: "acme/auditor", ownerLogin: "acme", ownerId: 900, isPrivate: false, defaultBranch: "main" };
  const repoB: Repo = { id: 556, nodeId: "R_b", fullName: "widgets/other", ownerLogin: "widgets", ownerId: 901, isPrivate: false, defaultBranch: "main" };
  const fetcher = makeFakeGithub({ repos: { "acme/auditor": repoA, "widgets/other": repoB } });
  const running = await startTestServer({ githubConfig: null, fetcher });
  try {
    const resourceVersionId = "99999999-9999-9999-9999-999999999999";
    const first = await fetch(`${running.baseUrl}/api/v1/source-claims`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ resourceId: "r1", resourceVersionId, repositoryFullName: "acme/auditor" }),
    });
    assert.equal(first.status, 201);

    const second = await fetch(`${running.baseUrl}/api/v1/source-claims`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ resourceId: "r1", resourceVersionId, repositoryFullName: "widgets/other" }),
    });
    assert.equal(second.status, 201);
    const secondBody = await second.json() as { conflict: { type: string; conflictingClaimId: string } | null; claim: { claimStatus: string } };
    assert.equal(secondBody.conflict?.type, "SOURCE_CLAIM_CONFLICT");
    assert.equal(secondBody.claim.claimStatus, "conflicted");
  } finally {
    await stopTestServer(running.server);
  }
});

test("GET /api/v1/source-claims/:claimId returns the claim with a verified digest", async () => {
  const repo: Repo = { id: 555, nodeId: "R_kgAA", fullName: "acme/auditor", ownerLogin: "acme", ownerId: 900, isPrivate: false, defaultBranch: "main" };
  const fetcher = makeFakeGithub({ repos: { "acme/auditor": repo } });
  const running = await startTestServer({ githubConfig: null, fetcher });
  try {
    const created = await fetch(`${running.baseUrl}/api/v1/source-claims`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ resourceId: "r1", resourceVersionId: "v1", repositoryFullName: "acme/auditor" }),
    });
    const createdBody = await created.json() as { claim: { id: string } };

    const fetched = await fetch(`${running.baseUrl}/api/v1/source-claims/${createdBody.claim.id}`);
    assert.equal(fetched.status, 200);
    const fetchedBody = await fetched.json() as { integrityVerified: boolean; claim: { id: string } };
    assert.equal(fetchedBody.integrityVerified, true);
    assert.equal(fetchedBody.claim.id, createdBody.claim.id);
  } finally {
    await stopTestServer(running.server);
  }
});

test("GET /api/v1/source-auth/github/repositories requires a session even when the GitHub App is configured", async () => {
  const githubConfig: GithubSourceAuthConfig = { ...GITHUB_CONFIG_BASE };
  const running = await startTestServer({ githubConfig, fetcher: makeFakeGithub({ repos: {} }) });
  try {
    const response = await fetch(`${running.baseUrl}/api/v1/source-auth/github/repositories`);
    assert.equal(response.status, 401);
    const body = await response.json() as { error: string };
    assert.equal(body.error, "source_auth_session_required");
  } finally {
    await stopTestServer(running.server);
  }
});

test("GET /api/v1/source-claims/:claimId returns 404 for an unknown claim", async () => {
  const running = await startTestServer({ githubConfig: null, fetcher: makeFakeGithub({ repos: {} }) });
  try {
    const response = await fetch(`${running.baseUrl}/api/v1/source-claims/does-not-exist`);
    assert.equal(response.status, 404);
  } finally {
    await stopTestServer(running.server);
  }
});
