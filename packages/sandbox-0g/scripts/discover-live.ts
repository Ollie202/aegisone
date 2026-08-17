import { DEFAULT_SANDBOX_API } from "../src/api.ts";

const apiUrl = (process.env.ZEROG_SANDBOX_API?.trim() || DEFAULT_SANDBOX_API).replace(/\/$/, "");

async function fetchRaw(path: string): Promise<{ status: number; ok: boolean; body: unknown }> {
  const response = await fetch(`${apiUrl}${path}`);
  const text = await response.text();
  let body: unknown = text;
  if (text) {
    try { body = JSON.parse(text); } catch { /* keep raw text */ }
  } else {
    body = null;
  }
  return { status: response.status, ok: response.ok, body };
}

const [info, providers, snapshots] = await Promise.all([
  fetchRaw("/api/info"),
  fetchRaw("/api/providers"),
  fetchRaw("/api/snapshots"),
]);

console.log(JSON.stringify({
  ok: info.ok && providers.ok && snapshots.ok,
  apiUrl,
  observedAt: new Date().toISOString(),
  info,
  providers,
  snapshots,
}, null, 2));

if (!info.ok || !providers.ok || !snapshots.ok) process.exitCode = 1;
