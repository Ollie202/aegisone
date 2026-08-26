import { test } from "node:test";
import assert from "node:assert/strict";
import {
  constantTimeStringEqual,
  createOAuthState,
  isSafeReturnTo,
  verifyOAuthState,
} from "../src/oauth-state.ts";
import { GithubSourceAuthError } from "../src/errors.ts";

const SECRET = "a".repeat(40);

test("createOAuthState/verifyOAuthState round-trips returnTo", () => {
  const token = createOAuthState(SECRET, "/source/claim");
  const payload = verifyOAuthState(SECRET, token);
  assert.equal(payload.returnTo, "/source/claim");
  assert.equal(typeof payload.nonce, "string");
  assert.ok(payload.nonce.length > 0);
});

test("verifyOAuthState rejects a tampered signature", () => {
  const token = createOAuthState(SECRET, "/source/claim");
  const [payloadB64] = token.split(".");
  const forged = `${payloadB64}.${"A".repeat(43)}`;
  assert.throws(() => verifyOAuthState(SECRET, forged), (error: unknown) => {
    assert.ok(error instanceof GithubSourceAuthError);
    assert.equal(error.code, "oauth_state_invalid");
    return true;
  });
});

test("verifyOAuthState rejects a state signed with a different secret", () => {
  const token = createOAuthState(SECRET, "/source/claim");
  assert.throws(() => verifyOAuthState("b".repeat(40), token), (error: unknown) => {
    assert.ok(error instanceof GithubSourceAuthError);
    assert.equal(error.code, "oauth_state_invalid");
    return true;
  });
});

test("verifyOAuthState rejects a malformed token", () => {
  assert.throws(() => verifyOAuthState(SECRET, "not-a-valid-token"), (error: unknown) => {
    assert.ok(error instanceof GithubSourceAuthError);
    assert.equal(error.code, "oauth_state_invalid");
    return true;
  });
});

test("verifyOAuthState rejects an expired state (replay/expiry protection)", () => {
  const token = createOAuthState(SECRET, "/source/claim", -1);
  assert.throws(() => verifyOAuthState(SECRET, token), (error: unknown) => {
    assert.ok(error instanceof GithubSourceAuthError);
    assert.equal(error.code, "oauth_state_expired");
    return true;
  });
});

test("createOAuthState produces distinct nonces for identical inputs (no deterministic replay surface)", () => {
  const a = createOAuthState(SECRET, "/source/claim");
  const b = createOAuthState(SECRET, "/source/claim");
  assert.notEqual(a, b);
});

test("constantTimeStringEqual compares state values correctly", () => {
  assert.ok(constantTimeStringEqual("abc", "abc"));
  assert.ok(!constantTimeStringEqual("abc", "abd"));
  assert.ok(!constantTimeStringEqual("abc", "abcd"));
});

test("isSafeReturnTo accepts local paths and rejects external/scheme-smuggled values", () => {
  assert.ok(isSafeReturnTo("/source/claim"));
  assert.ok(isSafeReturnTo("/"));
  assert.ok(!isSafeReturnTo("https://evil.example/steal"));
  assert.ok(!isSafeReturnTo("//evil.example"));
  assert.ok(!isSafeReturnTo("/\\evil.example"));
  assert.ok(!isSafeReturnTo("not-absolute"));
});

test("state secrets shorter than 32 characters are rejected", () => {
  assert.throws(() => createOAuthState("short-secret", "/x"));
});
