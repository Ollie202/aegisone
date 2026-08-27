import type { AdvisoryScanTransport, ZeroGComputeConfig } from "./types.ts";

/**
 * Real 0G Compute Network transport (`@0gfoundation/0g-compute-ts-sdk`, an OpenAI-compatible
 * decentralized inference marketplace — distinct from OpenAI/Anthropic and from 0G Sandbox
 * independent execution). Isolated in its own module, imported only by `apps/web`'s production
 * wiring and never by the deterministic test suite (AGENTS.md "0G-specific behavior stays behind
 * adapters").
 *
 * **Not exercised against the live network in this repository**: no `ZEROG_COMPUTE_PRIVATE_KEY`
 * exists in this environment (verified: `env | grep -i zerog` and the Railway variable list for
 * `aegisone-worker` were both checked and neither has it), and AGENTS.md's cost discipline
 * requires separate explicit approval before spending real funds against a live marketplace. The
 * broker method names below (`getServiceMetadata`, `getRequestHeaders`, `processResponse`) follow
 * 0G Compute Network's documented inference-broker pattern at the pinned SDK version
 * (`@0gfoundation/0g-compute-ts-sdk@0.9.0`); this file is the single place to adjust if a future
 * live run finds the actual API surface differs. Dynamic import keeps the SDK out of every code
 * path that does not actually request a live advisory scan.
 */
export function createLiveZeroGComputeTransport(config: ZeroGComputeConfig): AdvisoryScanTransport {
  return {
    async requestChatCompletion({ systemPrompt, userContent }) {
      const { ethers } = await import("ethers");
      const { createZGComputeNetworkBroker } = await import("@0gfoundation/0g-compute-ts-sdk");
      const provider = new ethers.JsonRpcProvider(config.rpcUrl);
      const wallet = new ethers.Wallet(config.privateKey, provider);
      const broker = await createZGComputeNetworkBroker(wallet);

      const { endpoint, model } = await broker.inference.getServiceMetadata(config.modelProvider);
      const headers = await broker.inference.getRequestHeaders(config.modelProvider, userContent);

      const response = await fetch(`${String(endpoint).replace(/\/+$/, "")}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
        }),
      });
      if (!response.ok) throw new Error(`0G Compute inference request failed (${response.status})`);
      const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
      const content = body.choices?.[0]?.message?.content;
      if (typeof content !== "string") throw new Error("0G Compute inference response missing message content");

      // Settle/verify the fee for this single request per the broker's documented flow. A
      // settlement failure must not fabricate a result — it propagates as a transport error, and
      // `runAdvisoryScan` turns that into an explicit `{ status: "error" }` outcome, never a
      // silently-invented advisory finding.
      await broker.inference.processResponse(config.modelProvider, content, headers);

      return { content, modelProvider: config.modelProvider };
    },
  };
}
