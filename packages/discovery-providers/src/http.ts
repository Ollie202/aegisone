import { DiscoveryProviderError } from "./errors.ts";

export type FetchLike = typeof fetch;

export interface BoundedJsonPostOptions {
  url: string;
  body: unknown;
  allowedOrigins: readonly string[];
  timeoutMs: number;
  maxResponseBytes: number;
  signal: AbortSignal;
  fetchImpl?: FetchLike;
  /** Allow at most one retry for safe transient failures (network error / timeout / 5xx), if the deadline permits. */
  allowRetry?: boolean;
}

function isTransient(code: string): boolean {
  return code === "network_error" || code === "timeout" || code === "upstream_error";
}

function originOf(url: string): string {
  return new URL(url).origin;
}

async function attemptOnce(options: BoundedJsonPostOptions): Promise<unknown> {
  const { url, body, allowedOrigins, timeoutMs, maxResponseBytes, signal, fetchImpl = fetch } = options;

  if (signal.aborted) {
    throw new DiscoveryProviderError("deadline_exceeded", "search deadline already elapsed before this provider call started");
  }

  const origin = originOf(url);
  if (!allowedOrigins.includes(origin)) {
    throw new DiscoveryProviderError("disallowed_origin", `origin ${origin} is not an allowlisted discovery provider origin`);
  }

  const perAttemptTimeout = AbortSignal.timeout(timeoutMs);
  const combinedSignal = AbortSignal.any([signal, perAttemptTimeout]);

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(body),
      redirect: "manual",
      signal: combinedSignal,
    });
  } catch (error) {
    if (signal.aborted) {
      throw new DiscoveryProviderError("deadline_exceeded", "search deadline elapsed while calling the provider");
    }
    if (perAttemptTimeout.aborted) {
      throw new DiscoveryProviderError("timeout", `provider request exceeded the ${timeoutMs}ms timeout`);
    }
    throw new DiscoveryProviderError("network_error", error instanceof Error ? error.message : String(error));
  }

  if (response.type === "opaqueredirect" || (response.status >= 300 && response.status < 400)) {
    throw new DiscoveryProviderError("redirect_blocked", "provider response was a redirect; redirects are not followed");
  }

  const contentLengthHeader = response.headers.get("content-length");
  if (contentLengthHeader !== null) {
    const declared = Number(contentLengthHeader);
    if (Number.isFinite(declared) && declared > maxResponseBytes) {
      throw new DiscoveryProviderError("response_too_large", `provider response declared ${declared} bytes, exceeding the ${maxResponseBytes}-byte limit`);
    }
  }

  if (!response.ok) {
    throw new DiscoveryProviderError("upstream_error", `provider responded with HTTP ${response.status}`);
  }

  if (response.body === null) {
    throw new DiscoveryProviderError("malformed_response", "provider response had no body");
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > maxResponseBytes) {
          throw new DiscoveryProviderError("response_too_large", `provider response exceeded the ${maxResponseBytes}-byte limit`);
        }
        chunks.push(value);
      }
    }
  } catch (error) {
    if (error instanceof DiscoveryProviderError) throw error;
    if (signal.aborted) throw new DiscoveryProviderError("deadline_exceeded", "search deadline elapsed while reading the provider response");
    if (perAttemptTimeout.aborted) throw new DiscoveryProviderError("timeout", `provider response read exceeded the ${timeoutMs}ms timeout`);
    throw new DiscoveryProviderError("network_error", error instanceof Error ? error.message : String(error));
  } finally {
    reader.releaseLock();
  }

  const text = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf8");
  try {
    return JSON.parse(text);
  } catch {
    throw new DiscoveryProviderError("malformed_response", "provider response was not valid JSON");
  }
}

/**
 * POST JSON to a fixed allowlisted origin with a strict timeout and a hard response-size cap.
 * Retries at most once for a transient failure (network error, timeout, or 5xx) if the shared
 * outer deadline has not already elapsed. Never follows redirects.
 */
export async function postBoundedJson(options: BoundedJsonPostOptions): Promise<unknown> {
  try {
    return await attemptOnce(options);
  } catch (error) {
    const canRetry = options.allowRetry === true
      && error instanceof DiscoveryProviderError
      && isTransient(error.code)
      && !options.signal.aborted;
    if (!canRetry) throw error;
    return attemptOnce({ ...options, allowRetry: false });
  }
}

export interface BoundedJsonGetOptions {
  url: string;
  allowedOrigins: readonly string[];
  timeoutMs: number;
  maxResponseBytes: number;
  signal: AbortSignal;
  fetchImpl?: FetchLike;
  /** Allow at most one retry for safe transient failures (network error / timeout / 5xx), if the deadline permits. */
  allowRetry?: boolean;
}

async function attemptGetOnce(options: BoundedJsonGetOptions): Promise<unknown> {
  const { url, allowedOrigins, timeoutMs, maxResponseBytes, signal, fetchImpl = fetch } = options;

  if (signal.aborted) {
    throw new DiscoveryProviderError("deadline_exceeded", "ingestion deadline already elapsed before this request started");
  }

  const origin = originOf(url);
  if (!allowedOrigins.includes(origin)) {
    throw new DiscoveryProviderError("disallowed_origin", `origin ${origin} is not an allowlisted discovery provider origin`);
  }

  const perAttemptTimeout = AbortSignal.timeout(timeoutMs);
  const combinedSignal = AbortSignal.any([signal, perAttemptTimeout]);

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "GET",
      headers: { accept: "application/json" },
      redirect: "manual",
      signal: combinedSignal,
    });
  } catch (error) {
    if (signal.aborted) {
      throw new DiscoveryProviderError("deadline_exceeded", "deadline elapsed while calling the provider");
    }
    if (perAttemptTimeout.aborted) {
      throw new DiscoveryProviderError("timeout", `request exceeded the ${timeoutMs}ms timeout`);
    }
    throw new DiscoveryProviderError("network_error", error instanceof Error ? error.message : String(error));
  }

  if (response.type === "opaqueredirect" || (response.status >= 300 && response.status < 400)) {
    throw new DiscoveryProviderError("redirect_blocked", "provider response was a redirect; redirects are not followed");
  }

  const contentLengthHeader = response.headers.get("content-length");
  if (contentLengthHeader !== null) {
    const declared = Number(contentLengthHeader);
    if (Number.isFinite(declared) && declared > maxResponseBytes) {
      throw new DiscoveryProviderError("response_too_large", `provider response declared ${declared} bytes, exceeding the ${maxResponseBytes}-byte limit`);
    }
  }

  if (!response.ok) {
    throw new DiscoveryProviderError("upstream_error", `provider responded with HTTP ${response.status}`);
  }

  if (response.body === null) {
    throw new DiscoveryProviderError("malformed_response", "provider response had no body");
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > maxResponseBytes) {
          throw new DiscoveryProviderError("response_too_large", `provider response exceeded the ${maxResponseBytes}-byte limit`);
        }
        chunks.push(value);
      }
    }
  } catch (error) {
    if (error instanceof DiscoveryProviderError) throw error;
    if (signal.aborted) throw new DiscoveryProviderError("deadline_exceeded", "deadline elapsed while reading the provider response");
    if (perAttemptTimeout.aborted) throw new DiscoveryProviderError("timeout", `provider response read exceeded the ${timeoutMs}ms timeout`);
    throw new DiscoveryProviderError("network_error", error instanceof Error ? error.message : String(error));
  } finally {
    reader.releaseLock();
  }

  const text = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf8");
  try {
    return JSON.parse(text);
  } catch {
    throw new DiscoveryProviderError("malformed_response", "provider response was not valid JSON");
  }
}

/**
 * GET JSON from a fixed allowlisted origin with a strict timeout and a hard response-size cap.
 * Retries at most once for a transient failure if the shared outer deadline has not already
 * elapsed. Never follows redirects. Used by the MCP Registry provider/ingestion sync, which
 * speaks a paginated `GET` list API rather than the `POST` ARD search wire shape.
 */
export async function getBoundedJson(options: BoundedJsonGetOptions): Promise<unknown> {
  try {
    return await attemptGetOnce(options);
  } catch (error) {
    const canRetry = options.allowRetry === true
      && error instanceof DiscoveryProviderError
      && isTransient(error.code)
      && !options.signal.aborted;
    if (!canRetry) throw error;
    return attemptGetOnce({ ...options, allowRetry: false });
  }
}
