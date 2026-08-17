import { randomBytes } from "node:crypto";
import { Wallet } from "ethers";

export const DEFAULT_SANDBOX_API = "https://private-sandbox-testnet.0g.ai";

export interface BrokerInfo {
  contractAddress: string;
  appId: string;
  chainId: number;
  rpcUrl: string;
  tappRegistry: string;
  raw: Record<string, unknown>;
}

export interface ProviderListing {
  address: string;
  url: string;
  appId: string;
  createFee: string;
  pricePerCpuPerMin?: string;
  pricePerMemGbPerMin?: string;
  raw: Record<string, unknown>;
}

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
  sealedOnly: boolean;
  raw: Record<string, unknown>;
}

export interface SandboxSnapshot {
  id: string;
  name: string;
  imageName?: string;
  state?: string;
  cpu?: number;
  mem?: number;
  disk?: number;
  raw: Record<string, unknown>;
}

export interface SignedHeaders {
  "X-Wallet-Address": string;
  "X-Signed-Message": string;
  "X-Wallet-Signature": string;
}

function asRecord(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`${name} must be a JSON object`);
  return value as Record<string, unknown>;
}

function pick(record: Record<string, unknown>, ...names: string[]): unknown {
  for (const name of names) if (record[name] !== undefined) return record[name];
  return undefined;
}

function requiredString(record: Record<string, unknown>, ...names: string[]): string {
  const value = pick(record, ...names);
  if (typeof value !== "string" || value.length === 0) throw new TypeError(`Missing string field ${names.join("/")}`);
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

export function parseBrokerInfo(value: unknown): BrokerInfo {
  const raw = asRecord(value, "broker info");
  const chainId = optionalNumber(raw, "chain_id", "chainId");
  if (!chainId) throw new TypeError("Missing chain_id");
  return {
    contractAddress: requiredString(raw, "contract_address", "contractAddress"),
    appId: requiredString(raw, "app_id", "appId"),
    chainId,
    rpcUrl: requiredString(raw, "rpc_url", "rpcUrl"),
    tappRegistry: requiredString(raw, "tapp_registry", "tappRegistry", "tapp_registry_address"),
    raw,
  };
}

export function parseProviderListing(value: unknown): ProviderListing {
  const raw = asRecord(value, "provider listing");
  return {
    address: requiredString(raw, "address"),
    url: requiredString(raw, "url"),
    appId: requiredString(raw, "app_id", "appId"),
    createFee: requiredString(raw, "create_fee", "createFee"),
    pricePerCpuPerMin: optionalString(raw, "price_per_cpu_per_min", "pricePerCpuPerMin"),
    pricePerMemGbPerMin: optionalString(raw, "price_per_mem_gb_per_min", "pricePerMemGbPerMin"),
    raw,
  };
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

export function parseSnapshots(value: unknown): SandboxSnapshot[] {
  if (!Array.isArray(value)) throw new TypeError("snapshots must be an array");
  return value.map((entry) => {
    const raw = asRecord(entry, "snapshot");
    return {
      id: requiredString(raw, "id"),
      name: requiredString(raw, "name"),
      imageName: optionalString(raw, "imageName", "image_name"),
      state: optionalString(raw, "state"),
      cpu: optionalNumber(raw, "cpu"),
      mem: optionalNumber(raw, "mem"),
      disk: optionalNumber(raw, "disk"),
      raw,
    };
  });
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

async function responseText(response: Response, context: string): Promise<string> {
  const text = await response.text();
  if (!response.ok) throw new Error(`${context}: HTTP ${response.status}: ${text.slice(0, 1000)}`);
  return text;
}

async function jsonResponse(response: Response, context: string): Promise<unknown> {
  const text = await responseText(response, context);
  if (!text) return null;
  try { return JSON.parse(text); } catch { throw new Error(`${context}: invalid JSON response`); }
}

export async function discoverBroker(apiUrl = DEFAULT_SANDBOX_API): Promise<{ info: BrokerInfo; providers: ProviderListing[] }> {
  const base = apiUrl.replace(/\/$/, "");
  const [infoResponse, providersResponse] = await Promise.all([fetch(`${base}/api/info`), fetch(`${base}/api/providers`)]);
  const info = parseBrokerInfo(await jsonResponse(infoResponse, "GET broker /api/info"));
  const providersRaw = await jsonResponse(providersResponse, "GET broker /api/providers");
  if (!Array.isArray(providersRaw)) throw new TypeError("broker providers must be an array");
  return { info, providers: providersRaw.map(parseProviderListing) };
}

export async function discoverProvider(provider: ProviderListing): Promise<{ info: SandboxInfo; snapshots: SandboxSnapshot[] }> {
  const base = provider.url.replace(/\/$/, "");
  const [infoResponse, snapshotsResponse] = await Promise.all([fetch(`${base}/api/info`), fetch(`${base}/api/snapshots`)]);
  const info = parseSandboxInfo(await jsonResponse(infoResponse, `GET ${provider.url} /api/info`));
  const snapshots = parseSnapshots(await jsonResponse(snapshotsResponse, `GET ${provider.url} /api/snapshots`));
  if (info.providerAddress.toLowerCase() !== provider.address.toLowerCase()) throw new Error("provider registry address does not match provider /api/info");
  return { info, snapshots };
}

export function selectExecutionProvider(surfaces: Array<{ listing: ProviderListing; info: SandboxInfo; snapshots: SandboxSnapshot[] }>): { listing: ProviderListing; info: SandboxInfo; snapshot: SandboxSnapshot } {
  for (const surface of surfaces) {
    if (surface.info.sealedOnly) continue;
    const snapshot = surface.snapshots.find((item) => item.state === "active" && item.name === "daytonaio/sandbox:0.5.0-slim")
      ?? surface.snapshots.find((item) => item.state === "active");
    if (snapshot) return { listing: surface.listing, info: surface.info, snapshot };
  }
  throw new Error("No non-sealed provider with an active snapshot is available for toolbox execution");
}

export class SandboxApiClient {
  readonly apiUrl: string;
  readonly wallet: Wallet;

  constructor(apiUrl: string, wallet: Wallet) {
    this.apiUrl = apiUrl.replace(/\/$/, "");
    this.wallet = wallet;
  }

  private async request(action: string, resourceId: string, path: string, init: RequestInit, payload: Record<string, unknown> = {}): Promise<Response> {
    const headers = await buildSignedHeaders(this.wallet, action, resourceId, payload);
    return fetch(`${this.apiUrl}${path}`, {
      ...init,
      headers: { ...headers, ...(init.body ? { "Content-Type": "application/json" } : {}), ...(init.headers ?? {}) },
    });
  }

  async create(payload: Record<string, unknown>): Promise<unknown> {
    const normalized = canonicalPayload(payload);
    return jsonResponse(await this.request("create", "", "/api/sandbox", { method: "POST", body: JSON.stringify(normalized) }, normalized), "POST /api/sandbox");
  }

  async list(): Promise<unknown> {
    return jsonResponse(await this.request("list", "", "/api/sandbox", { method: "GET" }), "GET /api/sandbox");
  }

  async exec(id: string, command: string, timeout = 60): Promise<unknown> {
    const body = { command, timeout };
    return jsonResponse(await this.request("toolbox", id, `/api/toolbox/${encodeURIComponent(id)}/toolbox/process/execute`, { method: "POST", body: JSON.stringify(body) }), "POST toolbox process/execute");
  }

  async gitClone(id: string, url: string, path: string, commitId: string): Promise<unknown> {
    const body = { url, path, commit_id: commitId };
    return jsonResponse(await this.request("toolbox", id, `/api/toolbox/${encodeURIComponent(id)}/toolbox/git/clone`, { method: "POST", body: JSON.stringify(body) }), "POST toolbox git/clone");
  }

  async downloadFile(id: string, path: string): Promise<Uint8Array> {
    const response = await this.request("toolbox", id, `/api/toolbox/${encodeURIComponent(id)}/toolbox/files/download?path=${encodeURIComponent(path)}`, { method: "GET" });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`GET toolbox files/download: HTTP ${response.status}: ${text.slice(0, 1000)}`);
    }
    return new Uint8Array(await response.arrayBuffer());
  }

  async delete(id: string): Promise<unknown> {
    return jsonResponse(await this.request("delete", id, `/api/sandbox/${encodeURIComponent(id)}`, { method: "DELETE" }), "DELETE /api/sandbox/:id");
  }
}
