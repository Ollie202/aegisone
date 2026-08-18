import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import type { VerificationJson } from "../../../packages/core/src/model.ts";
import { renderVerificationHtml } from "./render.ts";

function valueAfter(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const evidencePath = valueAfter("--evidence") ?? process.env.PROOFRAIL_EVIDENCE_FILE;
if (!evidencePath) throw new Error("Usage: pnpm --filter @proofrail/web start -- --evidence verification.json");
const port = Number(valueAfter("--port") ?? process.env.PORT ?? "3000");
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid port");

const verification = JSON.parse(await readFile(evidencePath, "utf8")) as VerificationJson;
const html = renderVerificationHtml(verification);
const server = createServer((request, response) => {
  if (request.url !== "/" && request.url !== "/index.html") {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found\n");
    return;
  }
  response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
  response.end(html);
});
server.listen(port, "0.0.0.0", () => process.stdout.write(`ProofRail viewer listening on :${port}\n`));
