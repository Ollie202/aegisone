import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { decodeCanonicalSkillPackage } from "../../skill-audit/src/package.ts";
import { summarizeSkillPackage } from "../../skill-audit/src/package.ts";
import type { DistributionArtifactRequest, DistributionAcquisitionOutcome } from "./model.ts";

/**
 * Bounded, SSRF-hardened download of one explicit, caller-supplied distribution artifact
 * reference (docs/17-m8-security-boundaries.md Threat M8-003). This is new network-layer code
 * (no existing bounded fetcher in this repo is scoped to arbitrary publisher URLs — every prior
 * one, e.g. `packages/source-auth-github/src/github-client.ts`, is pinned to a single fixed
 * origin), but it deliberately reuses the *existing* canonical package decoder
 * (`decodeCanonicalSkillPackage`) rather than adding a second archive extractor: the supported
 * distribution artifact family for M8.6 is exactly AegisOne's own
 * `proofrail-agent-skill-package-v1` canonical package format, the same format
 * `packages/m7-flow` already requires (`SkillSourceClaim.packageFormat`). Extraction/path/
 * duplicate/file-count protection is therefore entirely inherited from
 * `packages/skill-audit/src/package.ts`, which is already covered by its own tests.
 */

const HTTPS_PORT = "443";
const MAX_REDIRECTS = 3;
const MAX_RESPONSE_BYTES = 20 * 1024 * 1024; // matches docs/17 "max Skill package decompressed"
const TIMEOUT_MS = 10_000;

export class DistributionFetchError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "DistributionFetchError";
    this.code = code;
  }
}

function ipv4Octets(ip: string): number[] {
  return ip.split(".").map((part) => Number(part));
}

function isPrivateOrReservedIPv4(ip: string): boolean {
  const [a, b] = ipv4Octets(ip);
  if (a === undefined || b === undefined) return true;
  if (a === 127) return true; // loopback
  if (a === 10) return true; // RFC1918
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
  if (a === 192 && b === 168) return true; // RFC1918
  if (a === 169 && b === 254) return true; // link-local (includes cloud metadata 169.254.169.254)
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 0) return true; // "this" network / unspecified
  if (a >= 224) return true; // multicast (224-239) and reserved (240-255)
  return false;
}

function isPrivateOrReservedIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === "::1") return true; // loopback
  if (normalized === "::") return true; // unspecified
  if (normalized.startsWith("fe80:") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) return true; // link-local fe80::/10
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // unique-local fc00::/7
  if (normalized.startsWith("ff")) return true; // multicast ff00::/8
  if (normalized.startsWith("::ffff:")) {
    const mapped = normalized.slice("::ffff:".length);
    if (isIP(mapped) === 4) return isPrivateOrReservedIPv4(mapped);
  }
  return false;
}

function assertPublicAddress(address: string): void {
  const version = isIP(address);
  if (version === 4 && isPrivateOrReservedIPv4(address)) {
    throw new DistributionFetchError("distribution_private_address_blocked", `distribution target resolves to a blocked address: ${address}`);
  }
  if (version === 6 && isPrivateOrReservedIPv6(address)) {
    throw new DistributionFetchError("distribution_private_address_blocked", `distribution target resolves to a blocked address: ${address}`);
  }
  if (version === 0) {
    throw new DistributionFetchError("distribution_invalid_address", `not a valid IP address: ${address}`);
  }
}

async function assertPublicHost(hostname: string): Promise<void> {
  if (isIP(hostname)) {
    assertPublicAddress(hostname);
    return;
  }
  const records = await lookup(hostname, { all: true }).catch(() => {
    throw new DistributionFetchError("distribution_dns_resolution_failed", `could not resolve distribution host: ${hostname}`);
  });
  if (records.length === 0) {
    throw new DistributionFetchError("distribution_dns_resolution_failed", `distribution host resolved to no addresses: ${hostname}`);
  }
  for (const record of records) assertPublicAddress(record.address);
}

async function readBounded(response: Response, maxBytes: number): Promise<Uint8Array> {
  const contentLength = response.headers.get("content-length");
  if (contentLength !== null) {
    const declared = Number(contentLength);
    if (Number.isFinite(declared) && declared > maxBytes) {
      throw new DistributionFetchError("distribution_too_large", `distribution artifact exceeds ${maxBytes} bytes`);
    }
  }
  if (response.body === null) return new Uint8Array(0);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > maxBytes) {
          throw new DistributionFetchError("distribution_too_large", `distribution artifact exceeds ${maxBytes} bytes`);
        }
        chunks.push(value);
      }
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
}

export interface DistributionFetchOptions {
  readonly fetcher?: typeof fetch;
  /** Test-only escape hatch so this package's own tests can point at a local fixture HTTP
   * server. Never set from production code, and never derived from environment/config that a
   * caller could influence in production — the default (`false`) always enforces the private/
   * loopback/link-local/reserved address block. */
  readonly allowPrivateNetworkForTesting?: boolean;
}

/**
 * Downloads exactly one explicit distribution artifact URL and decodes it as a canonical Agent
 * Skill package. Fails closed on any SSRF/size/format/digest problem — never falls back to a
 * partial or unverified result.
 */
export async function fetchDistributionArtifact(
  request: DistributionArtifactRequest,
  options: DistributionFetchOptions = {},
): Promise<DistributionAcquisitionOutcome> {
  const fetcher = options.fetcher ?? fetch;
  let currentUrl = request.url;

  for (let redirectCount = 0; ; redirectCount += 1) {
    const parsed = new URL(currentUrl);
    if (parsed.protocol !== "https:") {
      throw new DistributionFetchError("distribution_scheme_not_allowed", `only https:// distribution URLs are supported, got ${parsed.protocol}`);
    }
    if (parsed.username || parsed.password) {
      throw new DistributionFetchError("distribution_url_credentials_not_allowed", "distribution URL must not contain userinfo credentials");
    }
    if (!options.allowPrivateNetworkForTesting) {
      if (parsed.port && parsed.port !== HTTPS_PORT) {
        throw new DistributionFetchError("distribution_port_not_allowed", `distribution URL must use the default HTTPS port, got ${parsed.port}`);
      }
      await assertPublicHost(parsed.hostname);
    }

    let response: Response;
    try {
      response = await fetcher(parsed.toString(), { redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (error) {
      throw new DistributionFetchError("distribution_network_error", error instanceof Error ? error.message : String(error));
    }

    if (response.status >= 300 && response.status < 400) {
      if (redirectCount >= MAX_REDIRECTS) {
        throw new DistributionFetchError("distribution_too_many_redirects", `distribution URL exceeded ${MAX_REDIRECTS} redirects`);
      }
      const location = response.headers.get("location");
      if (!location) {
        throw new DistributionFetchError("distribution_redirect_missing_location", "distribution redirect had no Location header");
      }
      currentUrl = new URL(location, parsed).toString();
      continue;
    }

    if (response.status !== 200) {
      throw new DistributionFetchError("distribution_fetch_failed", `distribution fetch returned status ${response.status}`);
    }

    const bytes = await readBounded(response, MAX_RESPONSE_BYTES);
    let entries;
    try {
      entries = decodeCanonicalSkillPackage(bytes);
    } catch (error) {
      throw new DistributionFetchError("distribution_malformed_package", error instanceof Error ? error.message : String(error));
    }
    const summary = summarizeSkillPackage(entries);
    if (request.expectedSha256 && summary.sha256.toLowerCase() !== request.expectedSha256.toLowerCase()) {
      throw new DistributionFetchError(
        "distribution_digest_mismatch",
        `downloaded distribution digest ${summary.sha256} did not match the expected digest ${request.expectedSha256}`,
      );
    }

    return { directoryName: "distribution", entries, publisherSha256: summary.sha256 };
  }
}
