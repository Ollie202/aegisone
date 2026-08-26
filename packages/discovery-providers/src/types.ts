import type { CapabilityResource } from "../../capability-model/src/model.ts";
import type { ArdResourceMediaType } from "../../discovery-ard/src/constants.ts";
import type { DiscoveryProviderErrorCode } from "./errors.ts";

/** Provider-independent parsed query. Mirrors the shape AegisOne already parses for local ARD search. */
export interface DiscoveryQuery {
  text: string;
  mediaTypes: ArdResourceMediaType[] | null;
  pageSize: number;
}

export interface DiscoveryProviderSuccess {
  readonly providerId: string;
  readonly ok: true;
  /** Normalized, M8.1-validated resources. Never carries upstream trust/evidence claims. */
  readonly resources: CapabilityResource[];
  /** Count of upstream entries that failed lenient normalization and were dropped rather than failing the whole provider call. */
  readonly skippedInvalidCount: number;
  readonly elapsedMs: number;
}

export interface DiscoveryProviderFailure {
  readonly providerId: string;
  readonly ok: false;
  readonly errorCode: DiscoveryProviderErrorCode | "unknown_error";
  readonly message: string;
  readonly elapsedMs: number;
}

export type DiscoveryProviderResult = DiscoveryProviderSuccess | DiscoveryProviderFailure;

/**
 * Read-only external discovery federation boundary. Every implementation must call only its
 * one fixed allowlisted upstream origin, respect the shared timeout/size/result-count limits,
 * and never let upstream metadata escalate AegisOne trust evidence.
 */
export interface DiscoveryProvider {
  readonly id: string;
  search(query: DiscoveryQuery, signal: AbortSignal): Promise<DiscoveryProviderResult>;
}

export interface FederatedSearchProviderStatus {
  readonly providerId: string;
  readonly ok: boolean;
  readonly resourceCount: number;
  readonly skippedInvalidCount: number;
  readonly errorCode?: DiscoveryProviderErrorCode | "unknown_error";
  readonly message?: string;
  readonly elapsedMs: number;
}

export interface FederatedSearchResult {
  readonly results: CapabilityResource[];
  readonly providerStatuses: FederatedSearchProviderStatus[];
}
