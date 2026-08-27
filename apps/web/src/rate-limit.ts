/**
 * Minimal in-memory fixed-window rate limiter for the new paste-to-scan public entry point
 * (docs/17-m8-security-boundaries.md Threat M8-005 "verification spend abuse", new "Paste-to-scan
 * limits" section). `POST /api/v1/scan` is deliberately reachable without any GitHub/session
 * auth (that is the point of the feature), so it needs its own bound distinct from every other
 * route in this app.
 *
 * Single-process, in-memory only: state resets on restart and is not shared across multiple
 * `proofrail-app` instances. This is a documented, known limitation matching the existing
 * "simple IP/session rate limit as traffic requires" guidance in docs/17 — it is not a
 * distributed limiter, and should be revisited if/when `proofrail-app` runs more than one
 * instance behind a load balancer.
 */
export class FixedWindowRateLimiter {
  readonly #limit: number;
  readonly #windowMs: number;
  #buckets = new Map<string, { count: number; windowStart: number }>();

  constructor(limit: number, windowMs: number) {
    if (!Number.isInteger(limit) || limit < 1) throw new RangeError("limit must be a positive integer");
    if (!Number.isInteger(windowMs) || windowMs < 1) throw new RangeError("windowMs must be a positive integer");
    this.#limit = limit;
    this.#windowMs = windowMs;
  }

  /** Returns `true` and records the request if `key` is still within its current window's limit;
   * returns `false` (and does not record it) once the limit for the current window is reached. */
  consume(key: string, now: number = Date.now()): boolean {
    const bucket = this.#buckets.get(key);
    if (!bucket || now - bucket.windowStart >= this.#windowMs) {
      this.#buckets.set(key, { count: 1, windowStart: now });
      return true;
    }
    if (bucket.count >= this.#limit) return false;
    bucket.count += 1;
    return true;
  }

  /** Test/diagnostic helper only. */
  reset(): void {
    this.#buckets.clear();
  }
}
