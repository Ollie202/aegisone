import { DEFAULT_SANDBOX_API } from "../src/api.ts";

const brokerUrl = (process.env.ZEROG_SANDBOX_API?.trim() || DEFAULT_SANDBOX_API).replace(/\/$/, "");

type RawResult = { status: number; ok: boolean; body: unknown };

async function fetchRaw(baseUrl: string, path: string): Promise<RawResult> {
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`);
    const text = await response.text();
    let body: unknown = text;
    if (text) {
      try { body = JSON.parse(text); } catch { /* keep raw text */ }
    } else {
      body = null;
    }
    return { status: response.status, ok: response.ok, body };
  } catch (error) {
    return { status: 0, ok: false, body: error instanceof Error ? error.message : String(error) };
  }
}

const [brokerInfo, providersResponse] = await Promise.all([
  fetchRaw(brokerUrl, "/api/info"),
  fetchRaw(brokerUrl, "/api/providers"),
]);

const providerRecords = Array.isArray(providersResponse.body)
  ? providersResponse.body.filter((value): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value))
  : [];

const providers = await Promise.all(providerRecords.map(async (provider) => {
  const address = typeof provider.address === "string" ? provider.address : "";
  const directUrl = typeof provider.url === "string" ? provider.url.replace(/\/$/, "") : "";
  const proxyUrl = address ? `${brokerUrl}/proxy/${address}` : "";
  const [directInfo, directSnapshots, proxyInfo, proxySnapshots] = await Promise.all([
    directUrl ? fetchRaw(directUrl, "/api/info") : Promise.resolve({ status: 0, ok: false, body: "missing provider url" }),
    directUrl ? fetchRaw(directUrl, "/api/snapshots") : Promise.resolve({ status: 0, ok: false, body: "missing provider url" }),
    proxyUrl ? fetchRaw(proxyUrl, "/api/info") : Promise.resolve({ status: 0, ok: false, body: "missing provider address" }),
    proxyUrl ? fetchRaw(proxyUrl, "/api/snapshots") : Promise.resolve({ status: 0, ok: false, body: "missing provider address" }),
  ]);
  return { registry: provider, directInfo, directSnapshots, proxyInfo, proxySnapshots };
}));

const ok = brokerInfo.ok && providersResponse.ok && providers.length > 0 && providers.some((provider) => provider.directInfo.ok || provider.proxyInfo.ok);
console.log(JSON.stringify({ ok, brokerUrl, observedAt: new Date().toISOString(), brokerInfo, providersResponse, providers }, null, 2));
if (!ok) process.exitCode = 1;
