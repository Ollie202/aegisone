import { createServer } from "node:http";
import { createWorkerStatus } from "./status.ts";
import { handlePublishEvidence, type PublishRouteConfig } from "./publish-route.ts";
import { buildPublishRouteConfig } from "./publish-config.ts";

const port = Number(process.env.PORT ?? "8080");
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid port");

const status = createWorkerStatus();
if (!status.signerConfigured) throw new Error("ZEROG_STORAGE_PRIVATE_KEY is required for the consolidated AegisOne worker");

/**
 * Fail closed: the publication route exists only when an internal token is configured. When it is
 * absent, `publishConfig` stays `null` and `/internal/publish-evidence` 404s exactly like any other
 * unknown path — the route is not merely unauthenticated-and-rejecting, it is not mounted at all.
 */
let publishConfig: PublishRouteConfig | null = null;
if (status.publishRouteEnabled) {
  publishConfig = buildPublishRouteConfig(process.env);
}

const server = createServer((request, response) => {
  // `/health` behaviour is deliberately unchanged and stays first.
  if (request.method === "GET" && request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
    response.end(`${JSON.stringify(status)}\n`);
    return;
  }

  if (publishConfig !== null) {
    void handlePublishEvidence(request, response, publishConfig)
      .then((handled) => {
        if (handled) return;
        response.writeHead(404, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
        response.end('{"error":"not_found"}\n');
      })
      .catch(() => {
        // Never leak an internal error detail (or anything derived from the signer) to a caller.
        response.writeHead(500, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
        response.end('{"error":"internal_error"}\n');
      });
    return;
  }

  response.writeHead(404, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end('{"error":"not_found"}\n');
});

server.listen(port, "0.0.0.0", () => {
  const publishState = status.publishRouteEnabled
    ? `internal publication route enabled (${status.registryCommitmentEnabled ? "storage + chain commitment" : "storage only"})`
    : "internal publication route disabled (no internal token configured)";
  process.stdout.write(
    `AegisOne worker standby listening on :${port}; signer configured, public signing disabled; ${publishState}\n`,
  );
});
