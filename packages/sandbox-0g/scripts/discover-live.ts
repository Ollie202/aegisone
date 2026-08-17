import { DEFAULT_SANDBOX_API, discoverSandbox } from "../src/api.ts";

const apiUrl = process.env.ZEROG_SANDBOX_API?.trim() || DEFAULT_SANDBOX_API;
const result = await discoverSandbox(apiUrl);

console.log(JSON.stringify({
  ok: true,
  apiUrl,
  observedAt: new Date().toISOString(),
  info: result.info,
  providers: result.providers,
  snapshots: result.snapshots,
}, null, 2));
