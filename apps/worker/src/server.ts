import { createServer } from "node:http";
import { createWorkerStatus } from "./status.ts";

const port = Number(process.env.PORT ?? "8080");
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid port");

const status = createWorkerStatus();
if (!status.signerConfigured) throw new Error("ZEROG_STORAGE_PRIVATE_KEY is required for the consolidated ProofRail worker");

const server = createServer((request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
    response.end(`${JSON.stringify(status)}\n`);
    return;
  }

  response.writeHead(404, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end('{"error":"not_found"}\n');
});

server.listen(port, "0.0.0.0", () => {
  process.stdout.write(`ProofRail worker standby listening on :${port}; signer configured, public signing disabled\n`);
});
