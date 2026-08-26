import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Threat M8-005 "verification spend abuse": ProofRail's expensive verification path (source
 * acquisition + reproduction, and eventually 0G Sandbox/Storage/registry work layered on top by
 * a later worker milestone) must never be reachable anonymously. M8.6 adds no public HTTP route
 * at all — `apps/web` and `apps/worker` gain nothing new in this issue — so today there is no
 * code path, public or otherwise, that can reach `runSkillVerificationEnrichment` except tests
 * and an explicit local fixture script. This module exists so that when M8.7/M8.8 do add a
 * trigger surface, they call the *same* authorization/concurrency gate instead of reinventing
 * one, rather than skipping it because "the package already does the work".
 *
 * `VerificationAuthorization` can only be constructed by `authorizeVerificationTrigger` in this
 * module (the brand symbol is not exported), so no caller can fabricate one by hand.
 */

const BRAND = Symbol("proofrail-verification-authorization");

export interface VerificationAuthorization {
  readonly [BRAND]: true;
  readonly subject: string;
}

export class VerificationNotAuthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VerificationNotAuthorizedError";
  }
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function constantTimeEqualHex(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "hex");
  const bufferB = Buffer.from(b, "hex");
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

/**
 * Validates a caller-supplied admin/worker token against a pre-shared digest (the same
 * hash-a-high-entropy-token-and-compare pattern `proofrail_app_auth` and the `proofrail-catalog`
 * Edge Function already use) and, only on success, mints a `VerificationAuthorization`. Never
 * logs the raw token; throws `VerificationNotAuthorizedError` (never silently downgrades) when
 * the token is missing or does not match.
 */
export function authorizeVerificationTrigger(
  providedToken: string | null | undefined,
  expectedTokenSha256: string,
  subject: string,
): VerificationAuthorization {
  if (!providedToken || providedToken.trim().length === 0) {
    throw new VerificationNotAuthorizedError("verification trigger requires an authorized worker/admin token");
  }
  if (!/^[0-9a-f]{64}$/i.test(expectedTokenSha256)) {
    throw new VerificationNotAuthorizedError("verification authorization is not configured with a valid expected token digest");
  }
  if (!constantTimeEqualHex(sha256Hex(providedToken), expectedTokenSha256.toLowerCase())) {
    throw new VerificationNotAuthorizedError("verification trigger token did not match the configured worker/admin token");
  }
  return { [BRAND]: true, subject };
}

/** Runtime guard used by `enrichment.ts`: TypeScript's structural typing (and this repo's
 * type-stripped `node --experimental-strip-types` execution, which erases type annotations
 * entirely at runtime) cannot stop a caller from passing an object literal shaped like
 * `VerificationAuthorization`, so the actual enforcement is this runtime brand-symbol check, not
 * the type alone. */
export function assertVerificationAuthorization(value: unknown): asserts value is VerificationAuthorization {
  if (typeof value !== "object" || value === null || (value as Record<symbol, unknown>)[BRAND] !== true) {
    throw new VerificationNotAuthorizedError("a valid VerificationAuthorization (from authorizeVerificationTrigger) is required");
  }
}

/** In-process concurrency cap (docs/17-m8-security-boundaries.md "Recommended M8 starting
 * limits": verification concurrency 1-2 on current budget). Queues by rejecting outright rather
 * than spawning unbounded concurrent source acquisitions/reproductions; a real queue is a later
 * milestone's concern, but nothing in this package may bypass this cap. */
export class VerificationConcurrencyLimiter {
  #inFlight = 0;
  readonly #max: number;

  constructor(max = 2) {
    if (!Number.isInteger(max) || max < 1) throw new RangeError("VerificationConcurrencyLimiter max must be a positive integer");
    this.#max = max;
  }

  get inFlight(): number {
    return this.#inFlight;
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.#inFlight >= this.#max) {
      throw new Error(`verification_concurrency_limit_exceeded: at most ${this.#max} concurrent verification(s) allowed`);
    }
    this.#inFlight += 1;
    try {
      return await fn();
    } finally {
      this.#inFlight -= 1;
    }
  }
}
