import type { CapabilityResource } from "../../capability-model/src/model.ts";
import type { ArdResourceMediaType } from "./constants.ts";

export type ArdMetadataValue = string | number | boolean | null;
export type ArdMetadata = Record<string, ArdMetadataValue>;

export interface ArdTrustManifest {
  identity: string;
  [key: string]: unknown;
}

export interface ArdEntry {
  identifier: string;
  displayName: string;
  type: string;
  url?: string;
  data?: Record<string, unknown>;
  description?: string;
  tags?: string[];
  capabilities?: string[];
  representativeQueries?: string[];
  version?: string;
  updatedAt?: string;
  metadata?: ArdMetadata;
  trustManifest?: ArdTrustManifest;
}

export interface ArdSearchResult extends ArdEntry {
  score: number;
  source: string;
}

export interface ArdCatalogManifest {
  specVersion: "1.0";
  host: {
    displayName: string;
    identifier?: string;
    documentationUrl?: string;
    logoUrl?: string;
  };
  entries: ArdEntry[];
}

export interface ArdSearchRequest {
  query: {
    text: string;
    filter?: {
      type?: string | string[];
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  federation?: string;
  pageSize?: number;
  pageToken?: string;
  [key: string]: unknown;
}

export interface ParsedArdSearchRequest {
  text: string;
  mediaTypes: ArdResourceMediaType[] | null;
  pageSize: number;
}

export interface ArdSearchResponse {
  results: ArdSearchResult[];
  referrals: ArdEntry[];
}

export interface ArdEntryMappingOptions {
  identifier?: string;
  content?: { url: string; data?: never } | { data: Record<string, unknown>; url?: never };
  tags?: string[];
  capabilities?: string[];
  representativeQueries?: string[];
}

export interface ArdInboundMappingContext {
  source: string;
  discoveredAt: string;
}

export interface LocalCatalogRecord {
  resource: CapabilityResource;
  entry: ArdEntry;
  searchableText: string;
}

export type ArdErrorCode = "invalid_request" | "request_too_large" | "unsupported_filter";
