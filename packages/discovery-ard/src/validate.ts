import {
  ARD_DEFAULT_PAGE_SIZE,
  ARD_MAX_PAGE_SIZE,
  ARD_MAX_QUERY_CODE_POINTS,
  ARD_MEDIA_TYPE_TO_RESOURCE_KIND,
  ARD_CATALOG_SPEC_VERSION,
  type ArdResourceMediaType,
} from "./constants.ts";
import { ArdAdapterError } from "./errors.ts";
import type { ArdCatalogManifest, ArdEntry, ParsedArdSearchRequest } from "./types.ts";

const ARD_IDENTIFIER_RE = /^urn:air:[a-zA-Z0-9.-]+(:[a-zA-Z0-9._-]+)+$/;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function assertOnlyKeys(value: Record<string, unknown>, allowed: readonly string[], path: string): void {
  const unexpected = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unexpected.length > 0) {
    throw new ArdAdapterError("invalid_request", `${path} contains unsupported field(s): ${unexpected.sort().join(", ")}`);
  }
}

function isAbsoluteHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function validateOptionalStringArray(value: unknown, path: string): void {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.some((item) => !isNonEmptyString(item))) {
    throw new ArdAdapterError("invalid_request", `${path} must be an array of non-empty strings`);
  }
}

export function assertValidArdEntry(entry: ArdEntry): void {
  if (!ARD_IDENTIFIER_RE.test(entry.identifier)) {
    throw new ArdAdapterError("invalid_request", "entry.identifier must be a domain-anchored urn:air identifier");
  }
  if (!isNonEmptyString(entry.displayName)) {
    throw new ArdAdapterError("invalid_request", "entry.displayName must be non-empty");
  }
  if (!isNonEmptyString(entry.type) || !entry.type.includes("/")) {
    throw new ArdAdapterError("invalid_request", "entry.type must be a media type");
  }

  const hasUrl = entry.url !== undefined;
  const hasData = entry.data !== undefined;
  if (hasUrl === hasData) {
    throw new ArdAdapterError("invalid_request", "ARD entries require exactly one of url or data");
  }
  if (entry.url !== undefined && !isAbsoluteHttpUrl(entry.url)) {
    throw new ArdAdapterError("invalid_request", "entry.url must be an absolute HTTP(S) URL");
  }
  if (entry.data !== undefined && !isObject(entry.data)) {
    throw new ArdAdapterError("invalid_request", "entry.data must be a JSON object");
  }

  validateOptionalStringArray(entry.tags, "entry.tags");
  validateOptionalStringArray(entry.capabilities, "entry.capabilities");
  validateOptionalStringArray(entry.representativeQueries, "entry.representativeQueries");
  if (entry.representativeQueries !== undefined && (entry.representativeQueries.length < 2 || entry.representativeQueries.length > 5)) {
    throw new ArdAdapterError("invalid_request", "entry.representativeQueries must contain 2 to 5 strings when present");
  }
  if (entry.updatedAt !== undefined && !Number.isFinite(Date.parse(entry.updatedAt))) {
    throw new ArdAdapterError("invalid_request", "entry.updatedAt must be an ISO 8601 timestamp");
  }
  if (entry.metadata !== undefined) {
    if (!isObject(entry.metadata)) {
      throw new ArdAdapterError("invalid_request", "entry.metadata must be a JSON object");
    }
    for (const [key, value] of Object.entries(entry.metadata)) {
      if (
        !isNonEmptyString(key)
        || (value !== null && !["string", "number", "boolean"].includes(typeof value))
        || (typeof value === "number" && !Number.isFinite(value))
      ) {
        throw new ArdAdapterError("invalid_request", "entry.metadata values must be strings, numbers, booleans, or null");
      }
    }
  }
  if (entry.trustManifest !== undefined) {
    if (!isObject(entry.trustManifest) || !isNonEmptyString(entry.trustManifest.identity)) {
      throw new ArdAdapterError("invalid_request", "entry.trustManifest.identity must be non-empty");
    }
  }
}

export function assertValidArdCatalogManifest(manifest: ArdCatalogManifest): void {
  if (manifest.specVersion !== ARD_CATALOG_SPEC_VERSION) {
    throw new ArdAdapterError("invalid_request", `catalog specVersion must be ${ARD_CATALOG_SPEC_VERSION}`);
  }
  if (!isNonEmptyString(manifest.host.displayName)) {
    throw new ArdAdapterError("invalid_request", "catalog host.displayName must be non-empty");
  }
  if (manifest.host.documentationUrl !== undefined && !isAbsoluteHttpUrl(manifest.host.documentationUrl)) {
    throw new ArdAdapterError("invalid_request", "catalog host.documentationUrl must be an absolute HTTP(S) URL");
  }
  for (const entry of manifest.entries) assertValidArdEntry(entry);
}

function parseTypeFilter(value: unknown): ArdResourceMediaType[] {
  const values = typeof value === "string" ? [value] : value;
  if (!Array.isArray(values) || values.length === 0 || values.some((item) => !isNonEmptyString(item))) {
    throw new ArdAdapterError("invalid_request", "query.filter.type must be a non-empty string or array of non-empty strings");
  }

  const unique = [...new Set(values)];
  for (const mediaType of unique) {
    if (!Object.hasOwn(ARD_MEDIA_TYPE_TO_RESOURCE_KIND, mediaType)) {
      throw new ArdAdapterError("unsupported_filter", `query.filter.type does not support media type: ${mediaType}`);
    }
  }
  return unique as ArdResourceMediaType[];
}

export function parseArdSearchRequest(value: unknown): ParsedArdSearchRequest {
  if (!isObject(value)) throw new ArdAdapterError("invalid_request", "request body must be a JSON object");
  assertOnlyKeys(value, ["query", "federation", "pageSize", "pageToken"], "request");

  if (!isObject(value.query)) throw new ArdAdapterError("invalid_request", "query must be a JSON object");
  assertOnlyKeys(value.query, ["text", "filter"], "query");
  if (!isNonEmptyString(value.query.text)) throw new ArdAdapterError("invalid_request", "query.text is required");
  const text = value.query.text.trim();
  if ([...text].length > ARD_MAX_QUERY_CODE_POINTS) {
    throw new ArdAdapterError("invalid_request", `query.text must be at most ${ARD_MAX_QUERY_CODE_POINTS} Unicode characters`);
  }

  let mediaTypes: ArdResourceMediaType[] | null = null;
  if (value.query.filter !== undefined) {
    if (!isObject(value.query.filter)) throw new ArdAdapterError("invalid_request", "query.filter must be a JSON object");
    const unsupported = Object.keys(value.query.filter).filter((key) => key !== "type");
    if (unsupported.length > 0) {
      throw new ArdAdapterError("unsupported_filter", `unsupported query.filter field(s): ${unsupported.sort().join(", ")}`);
    }
    if (value.query.filter.type !== undefined) mediaTypes = parseTypeFilter(value.query.filter.type);
  }

  if (value.federation !== undefined && value.federation !== "none") {
    throw new ArdAdapterError("invalid_request", "M8.2 local search supports federation=none only");
  }
  if (value.pageToken !== undefined) {
    throw new ArdAdapterError("invalid_request", "pageToken is not supported by the bounded M8.2 local catalog");
  }

  const pageSize = value.pageSize ?? ARD_DEFAULT_PAGE_SIZE;
  if (!Number.isInteger(pageSize) || (pageSize as number) < 1 || (pageSize as number) > ARD_MAX_PAGE_SIZE) {
    throw new ArdAdapterError("invalid_request", `pageSize must be an integer from 1 to ${ARD_MAX_PAGE_SIZE}`);
  }

  return { text, mediaTypes, pageSize: pageSize as number };
}

export function assertSupportedArdResourceType(type: string): asserts type is ArdResourceMediaType {
  if (!Object.hasOwn(ARD_MEDIA_TYPE_TO_RESOURCE_KIND, type)) {
    throw new ArdAdapterError("invalid_request", `unsupported ARD resource media type: ${type}`);
  }
}

export function assertAbsoluteHttpUrl(value: string, path: string): void {
  if (!isAbsoluteHttpUrl(value)) throw new ArdAdapterError("invalid_request", `${path} must be an absolute HTTP(S) URL`);
}
