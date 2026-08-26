import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import {
  authorizeVerificationTrigger,
  VerificationConcurrencyLimiter,
  VerificationNotAuthorizedError,
} from "../src/authorization.ts";

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

const REAL_TOKEN = "super-secret-worker-token";
const EXPECTED_DIGEST = sha256Hex(REAL_TOKEN);

test("a valid token mints an authorization", () => {
  const auth = authorizeVerificationTrigger(REAL_TOKEN, EXPECTED_DIGEST, "worker");
  assert.equal(auth.subject, "worker");
});

test("a missing token is rejected (anonymous callers cannot authorize)", () => {
  assert.throws(() => authorizeVerificationTrigger(undefined, EXPECTED_DIGEST, "worker"), VerificationNotAuthorizedError);
  assert.throws(() => authorizeVerificationTrigger("", EXPECTED_DIGEST, "worker"), VerificationNotAuthorizedError);
  assert.throws(() => authorizeVerificationTrigger("   ", EXPECTED_DIGEST, "worker"), VerificationNotAuthorizedError);
});

test("a wrong token is rejected", () => {
  assert.throws(() => authorizeVerificationTrigger("guessed-token", EXPECTED_DIGEST, "worker"), VerificationNotAuthorizedError);
});

test("a misconfigured expected digest never silently authorizes", () => {
  assert.throws(() => authorizeVerificationTrigger(REAL_TOKEN, "not-a-hex-digest", "worker"), VerificationNotAuthorizedError);
});

test("VerificationConcurrencyLimiter rejects work beyond its cap instead of queuing unbounded concurrency", async () => {
  const limiter = new VerificationConcurrencyLimiter(1);
  let releaseFirst: () => void = () => {};
  const first = limiter.run(() => new Promise<void>((resolvePromise) => { releaseFirst = resolvePromise; }));
  await assert.rejects(limiter.run(async () => {}), /verification_concurrency_limit_exceeded/);
  releaseFirst();
  await first;
  await limiter.run(async () => {}); // capacity freed after completion
});
