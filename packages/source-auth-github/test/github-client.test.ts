import { test } from "node:test";
import assert from "node:assert/strict";
import {
  exchangeCodeForAccessToken,
  getAuthenticatedUser,
  getCollaboratorPermission,
  getCommit,
  getRepository,
  listInstallationRepositories,
  listUserInstallations,
} from "../src/github-client.ts";
import { GithubSourceAuthError } from "../src/errors.ts";
import type { GithubSourceAuthConfig } from "../src/model.ts";

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  const text = body === null ? "" : JSON.stringify(body);
  return new Response(text, { status, headers: { "content-type": "application/json", ...headers } });
}

function fakeFetch(handler: (url: string, init: RequestInit) => Response): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    return handler(url, init ?? {});
  }) as typeof fetch;
}

const CONFIG: GithubSourceAuthConfig = {
  clientId: "test-client-id",
  clientSecret: "test-client-secret",
  appSlug: "aegisone-source-verifier",
  callbackUrl: "https://proofrail-app-production.up.railway.app/auth/github/callback",
  stateSecret: "s".repeat(40),
};

test("exchangeCodeForAccessToken parses a successful token exchange and never needs to see the secret again", async () => {
  const fetcher = fakeFetch((url, init) => {
    assert.equal(url, "https://github.com/login/oauth/access_token");
    const body = JSON.parse(init.body as string);
    assert.equal(body.client_id, CONFIG.clientId);
    assert.equal(body.client_secret, CONFIG.clientSecret);
    assert.equal(body.code, "abc123");
    return jsonResponse(200, { access_token: "ghu_faketoken", scope: "" });
  });
  const result = await exchangeCodeForAccessToken({ ...CONFIG, fetcher }, "abc123");
  assert.equal(result.accessToken, "ghu_faketoken");
});

test("exchangeCodeForAccessToken fails closed on a malformed/error response", async () => {
  const fetcher = fakeFetch(() => jsonResponse(400, { error: "bad_verification_code" }));
  await assert.rejects(
    () => exchangeCodeForAccessToken({ ...CONFIG, fetcher }, "bad-code"),
    (error: unknown) => {
      assert.ok(error instanceof GithubSourceAuthError);
      assert.equal(error.code, "oauth_token_exchange_failed");
      return true;
    },
  );
});

test("getAuthenticatedUser resolves the real GitHub identity", async () => {
  const fetcher = fakeFetch((url, init) => {
    assert.equal(url, "https://api.github.com/user");
    assert.equal((init.headers as Record<string, string>).authorization, "Bearer ghu_faketoken");
    return jsonResponse(200, { id: 42, login: "octocat" });
  });
  const user = await getAuthenticatedUser("ghu_faketoken", fetcher);
  assert.deepEqual(user, { id: 42, login: "octocat" });
});

test("getAuthenticatedUser surfaces a 401 distinctly from other failures", async () => {
  const fetcher = fakeFetch(() => jsonResponse(401, { message: "Bad credentials" }));
  await assert.rejects(() => getAuthenticatedUser("expired", fetcher), (error: unknown) => {
    assert.ok(error instanceof GithubSourceAuthError);
    assert.equal(error.status, 401);
    return true;
  });
});

test("listUserInstallations normalizes installations and caps the result count", async () => {
  const fetcher = fakeFetch(() => jsonResponse(200, {
    installations: [
      { id: 1, account: { login: "acme", id: 900 } },
      { id: 2, account: { login: "widgets", id: 901 } },
    ],
  }));
  const installations = await listUserInstallations("ghu_faketoken", fetcher);
  assert.equal(installations.length, 2);
  assert.deepEqual(installations[0], { id: 1, accountLogin: "acme", accountId: 900 });
});

test("listInstallationRepositories normalizes stable repository IDs and effective permissions", async () => {
  const fetcher = fakeFetch(() => jsonResponse(200, {
    repositories: [
      {
        id: 555,
        node_id: "R_kgAA",
        full_name: "acme/auditor",
        owner: { login: "acme", id: 900 },
        private: false,
        default_branch: "main",
        permissions: { admin: false, maintain: false, push: true, triage: true, pull: true },
      },
    ],
  }));
  const repos = await listInstallationRepositories("ghu_faketoken", 1, fetcher);
  assert.equal(repos.length, 1);
  assert.equal(repos[0]?.id, 555);
  assert.equal(repos[0]?.permission, "write");
  assert.equal(repos[0]?.isPrivate, false);
});

test("getCollaboratorPermission distinguishes real write authority from read-only", async () => {
  const fetcher = fakeFetch(() => jsonResponse(200, { permission: "write", role_name: "write" }));
  const permission = await getCollaboratorPermission("ghu_faketoken", "acme", "auditor", "octocat", fetcher);
  assert.equal(permission.permission, "write");
});

test("getRepository resolves stable repository identity independent of the requested owner/name text", async () => {
  const fetcher = fakeFetch(() => jsonResponse(200, {
    id: 555,
    node_id: "R_kgAA",
    full_name: "acme/auditor",
    owner: { login: "acme", id: 900 },
    private: false,
    default_branch: "main",
  }));
  const repo = await getRepository("acme", "auditor", undefined, fetcher);
  assert.equal(repo.id, 555);
  assert.equal(repo.ownerId, 900);
});

test("getRepository surfaces a 404 as github_repository_not_found", async () => {
  const fetcher = fakeFetch(() => jsonResponse(404, { message: "Not Found" }));
  await assert.rejects(() => getRepository("acme", "does-not-exist", undefined, fetcher), (error: unknown) => {
    assert.ok(error instanceof GithubSourceAuthError);
    assert.equal(error.code, "github_repository_not_found");
    return true;
  });
});

test("getCommit resolves the exact 40-character commit SHA, never a mutable ref", async () => {
  const sha = "a".repeat(40);
  const fetcher = fakeFetch((url) => {
    assert.ok(url.includes("/commits/main"));
    return jsonResponse(200, { sha });
  });
  const commit = await getCommit("acme", "auditor", "main", undefined, fetcher);
  assert.equal(commit.sha, sha);
});

test("getCommit rejects a response that is not a full 40-character hex SHA", async () => {
  const fetcher = fakeFetch(() => jsonResponse(200, { sha: "not-a-sha" }));
  await assert.rejects(() => getCommit("acme", "auditor", "main", undefined, fetcher), (error: unknown) => {
    assert.ok(error instanceof GithubSourceAuthError);
    assert.equal(error.code, "github_commit_not_found");
    return true;
  });
});

test("an oversized declared Content-Length is rejected before reading the body", async () => {
  const fetcher = fakeFetch(() => new Response("{}", {
    status: 200,
    headers: { "content-type": "application/json", "content-length": String(5 * 1024 * 1024) },
  }));
  await assert.rejects(() => getAuthenticatedUser("token", fetcher), (error: unknown) => {
    assert.ok(error instanceof GithubSourceAuthError);
    assert.equal(error.code, "github_response_too_large");
    return true;
  });
});
