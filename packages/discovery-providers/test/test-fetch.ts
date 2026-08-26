import type { FetchLike } from "../src/http.ts";

export function jsonResponseFetch(body: unknown, init: { status?: number; withContentLength?: boolean } = {}): FetchLike {
  const status = init.status ?? 200;
  const text = JSON.stringify(body);
  return async () => {
    const headers = new Headers({ "content-type": "application/json" });
    if (init.withContentLength !== false) headers.set("content-length", String(Buffer.byteLength(text, "utf8")));
    return new Response(text, { status, headers });
  };
}

export function textResponseFetch(text: string, init: { status?: number } = {}): FetchLike {
  const status = init.status ?? 200;
  return async () => new Response(text, { status, headers: { "content-type": "application/json" } });
}

/** Response whose body is a stream with no content-length header, for streamed-size-cap tests. */
export function streamedOversizedFetch(byteLength: number): FetchLike {
  return async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(byteLength).fill(65));
        controller.close();
      },
    });
    return new Response(stream, { status: 200, headers: { "content-type": "application/json" } });
  };
}

export function redirectFetch(): FetchLike {
  return async () => new Response(null, { status: 302, headers: { location: "https://evil.example.test/" } });
}

/**
 * Rejects with an AbortError once the request's signal aborts; otherwise never resolves.
 *
 * `AbortSignal.timeout()` intentionally backs its internal timer with an unref'd handle (it must
 * not keep a process alive on its own). A real `fetch()` call has its own ref'd sockets/timers
 * keeping the event loop open while in flight, but this fake has nothing else pending — without
 * an explicit ref'd keep-alive here, Node can conclude the event loop is idle and let the process
 * wind down before the timeout signal actually fires, which node:test reports as "Promise
 * resolution is still pending but the event loop has already resolved" instead of the intended
 * timeout behavior.
 */
export function neverRespondingFetch(): FetchLike {
  return (_url, requestInit) =>
    new Promise((_resolve, reject) => {
      const signal = requestInit?.signal as AbortSignal | undefined;
      const keepAlive = setInterval(() => {}, 1_000_000);
      const cleanup = () => clearInterval(keepAlive);
      if (!signal) {
        cleanup();
        return;
      }
      if (signal.aborted) {
        cleanup();
        reject(new DOMException("aborted", "AbortError"));
        return;
      }
      signal.addEventListener("abort", () => {
        cleanup();
        reject(new DOMException("aborted", "AbortError"));
      });
    });
}

export function throwingFetch(message = "simulated network failure"): FetchLike {
  return async () => {
    throw new TypeError(message);
  };
}

/** Fails with a network error on the first call, then succeeds on the second (for retry tests). */
export function flakyThenOkFetch(okBody: unknown): { fetchImpl: FetchLike; callCount: () => number } {
  let calls = 0;
  const fetchImpl: FetchLike = async (...args) => {
    calls += 1;
    if (calls === 1) throw new TypeError("simulated transient network failure");
    const text = JSON.stringify(okBody);
    return new Response(text, { status: 200, headers: { "content-type": "application/json", "content-length": String(Buffer.byteLength(text, "utf8")) } });
  };
  return { fetchImpl, callCount: () => calls };
}
