import { randomBytes } from "node:crypto";
import { Wallet } from "ethers";

export const DEFAULT_SANDBOX_API = "https://private-sandbox-testnet.0g.ai";

export interface SandboxInfo {
  contractAddress: string;
  providerAddress: string;
  ownerAddress?: string;
  appId: string;
  chainId: number;
  rpcUrl: string;
  tappRegistry?: string;
  createFee: string;
  computePricePerSec?: string;
  voucherIntervalSec?: number;
  minBalance?: string;
  sealedOnly?: boolean;
  raw: Record<string, unknown>;
}

export interface SignedHeaders {
  "X-Wallet-Address": string;
  "X-Signed-Message": string;
  "X-Wallet-Signature": string;
}

function asRecord(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${name} must be a JSON object`);
  }
  return value as Record<string, unknown>;
}

function pick(record: Record<string, unknown>, ...names: string[]): unknown {
  for (const name of names) if (record[name] !== undefined) return record[name];
  return undefined;
}

function requiredString(record: Record<string, unknown>, ...names: string[]): string {
  const value = pick(record, ...names);
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`Missing string field ${names.join("/")}`);
  }
  return value;
}

function optionalString(record: Record<string, unknown>, ...names: string[]): string | undefined {
  const value = pick(record, ...names);
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function optionalNumber(record: Record<string, unknown>, ...names: string[]): number | undefined {
  const value = pick(record, ...names);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return undefined;
}

export function parseSandboxInfo(value: unknown): SandboxInfo {
  const raw = asRecord(value, "sandbox info");
  const chainId = optionalNumber(raw, "chain_id", "chainId");
  if (!chainId) throw new TypeError("Missing chain_id");
  return {
    contractAddress: requiredString(raw, "contract_address", "contractAddress"),
    providerAddress: requiredString(raw, "provider_address", "providerAddress"),
    ownerAddress: optionalString(raw, "owner_address", "ownerAddress"),
    appId: requiredString(raw, "app_id", "appId"),
    chainId,
    rpcUrl: requiredString(raw, "rpc_url", "rpcUrl"),
    tappRegistry: optionalString(raw, "tapp_registry", "tappRegistry", "tapp_registry_address"),
    createFee: requiredString(raw, "create_fee", "createFee"),
    computePricePerSec: optionalString(raw, "compute_price_per_sec", "computePricePerSec"),
    voucherIntervalSec: optionalNumber(raw, "voucher_interval_sec", "voucherIntervalSec"),
    minBalance: optionalString(raw, "min_balance", "minBalance"),
    sealedOnly: pick(raw, "sealed_only", "sealedOnly") === true,
    raw,
  };
}

export function canonicalPayload<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => canonicalPayload(item)) as T;
  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) out[key] = canonicalPayload(source[key]);
    return out as T;
  }
  return value;
}

export async function buildSignedHeaders(
  wallet: Wallet,
  action: string,
  resourceId: string,
  payload: Record<string, unknown> = {},
  options: { now?: number; nonce?: string } = {},
): Promise<SignedHeaders> {
  const signedObject = {
    action,
    expires_at: (options.now ?? Math.floor(Date.now() / 1000)) + 180,
    nonce: options.nonce ?? randomBytes(16).toString("hex"),
    payload: canonicalPayload(payload),
    resource_id: resourceId,
  };
  const message = JSON.stringify(signedObject);
  const signature = await wallet.signMessage(message);
  return {
    "X-Wallet-Address": wallet.address,
    "X-Signed-Message": Buffer.from(message).toString("base64"),
    "X-Wallet-Signature": signature,
  };
}

async function jsonResponse(response: Response, context: string): Promise<unknown> {
  const text = await response.text();
  if (!response.ok) throw new Error(`${context}: HTTP ${response.status}: ${text.slice(0, 1000)}`);
  if (!text) return null;
  try { return JSON.parse(text); } catch { throw new Error(`${context}: invalid JSON response`); }
}

export async function discoverSandbox(apiUrl = DEFAULT_SANDBOX_API): Promise<{
  info: SandboxInfo;
  providers: unknown;
  snapshots: unknown;
}> {
  const base = apiUrl.replace(/\/$/, "");
  const [infoResponse, providersResponse, snapshotsResponse] = await Promise.all([
    fetch(`${base}/api/info`),
    fetch(`${base}/api/providers`),
    fetch(`${base}/api/snapshots`),
  ]);
  const info = parseSandboxInfo(await jsonResponse(infoResponse, "GET /api/info"));
  const providers = await jsonResponse(providersResponse, "GET /api/providers");
  const snapshots = await jsonResponse(snapshotsResponse, "GET /api/snapshots");
  return { info, providers, snapshots };
}

export class SandboxApiClient {
  readonly apiUrl: string;
  readonly wallet: Wallet;

  constructor(apiUrl: string, wallet: Wallet) {
    this.apiUrl = apiUrl;
    this.wallet = wallet;
  }

  private async request(action: string, resourceId: string, path: string, init: RequestInit, payload: Record<string, unknown> = {}): Promise<unknown> {
    const headers = await buildSignedHeaders(this.wallet, action, resourceId, payload);
    const response = await fetch(`${this.apiUrl.replace(/\/$/, "")}${path}`, {
      ...init,
      headers: { ...headers, ...(init.body ? { "Content-Type": "application/json" } : {}), ...(init.headers ?? {}) },
    });
    return jsonResponse(response, `${init.method ?? "GET"} ${path}`);
  }

  create(payload: Record<string, unknown>): Promise<unknown> {
    const normalized = canonicalPayload(payload);
    return this.request("create", "", "/api/sandbox", { method: "POST", body: JSON.stringify(normalized) }, normalized);
  }

  list(): Promise<unknown> {
    return this.request("list", "", "/api/sandbox", { method: "GET" });
  }

  exec(id: string, command: string, timeout = 60): Promise<unknown> {
    const body = { command, timeout };
    return this.request("toolbox", id, `/api/toolbox/${encodeURIComponent(id)}/toolbox/process/execute`, { method: "POST", body: JSON.stringify(body) });
  }

  delete(id: string): Promise<unknown> {
    return this.request("delete", id, `/api/sandbox/${encodeURIComponent(id)}`, { method: "DELETE" });
  }
}
