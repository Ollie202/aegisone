import type { CapabilityResourceKind } from "../../capability-model/src/model.ts";

export const ARD_SPEC_VERSION = "0.9" as const;
export const ARD_SPEC_STATUS = "Draft / Proposal" as const;
export const ARD_SPEC_DATE = "2026-05-28" as const;
export const ARD_SPEC_COMMIT = "1d25abcf07e081f604dba3ae5398b16c79f20b7b" as const;
export const ARD_SPEC_REPOSITORY = "ards-project/ard-spec" as const;
export const ARD_CATALOG_SPEC_VERSION = "1.0" as const;

export const ARD_UPSTREAM_FILES = {
  specification: {
    path: "spec/ard.md",
    gitBlobSha: "153a01c922ddb75f9d0d3b4abdfb74579abc97d9",
  },
  catalogSchema: {
    path: "spec/schemas/ai-catalog.schema.json",
    gitBlobSha: "37c4cb743b29741847e6f99f8bc8ccaaa2d6e422",
  },
  entrySchema: {
    path: "spec/schemas/ard-entry.schema.json",
    gitBlobSha: "f06cfec015c248e6994d0aa53ce8a03e27ad80e4",
  },
  openApi: {
    path: "spec/schemas/ard.openapi.yaml",
    gitBlobSha: "925af8cb8cbb86a9ecd72763bf70d33b4233004b",
  },
} as const;

export const ARD_MAX_REQUEST_BODY_BYTES = 32 * 1024;
export const ARD_MAX_QUERY_CODE_POINTS = 2_000;
export const ARD_DEFAULT_PAGE_SIZE = 10;
export const ARD_MAX_PAGE_SIZE = 25;

export const ARD_MEDIA_TYPES = {
  agentSkill: "application/ai-skill",
  mcpServer: "application/mcp-server-card+json",
  a2aAgent: "application/a2a-agent-card+json",
  api: "application/openapi+json",
  registry: "application/ai-registry+json",
} as const;

export type ArdResourceMediaType =
  | typeof ARD_MEDIA_TYPES.agentSkill
  | typeof ARD_MEDIA_TYPES.mcpServer
  | typeof ARD_MEDIA_TYPES.a2aAgent
  | typeof ARD_MEDIA_TYPES.api;

export const RESOURCE_KIND_TO_ARD_MEDIA_TYPE: Readonly<Record<CapabilityResourceKind, ArdResourceMediaType>> = {
  "agent-skill": ARD_MEDIA_TYPES.agentSkill,
  "mcp-server": ARD_MEDIA_TYPES.mcpServer,
  "a2a-agent": ARD_MEDIA_TYPES.a2aAgent,
  api: ARD_MEDIA_TYPES.api,
};

export const ARD_MEDIA_TYPE_TO_RESOURCE_KIND: Readonly<Record<ArdResourceMediaType, CapabilityResourceKind>> = {
  [ARD_MEDIA_TYPES.agentSkill]: "agent-skill",
  [ARD_MEDIA_TYPES.mcpServer]: "mcp-server",
  [ARD_MEDIA_TYPES.a2aAgent]: "a2a-agent",
  [ARD_MEDIA_TYPES.api]: "api",
};

export const PROOFRAIL_ARD_REGISTRY_IDENTIFIER =
  "urn:air:proofrail-app-production.up.railway.app:registry:capability-search" as const;

export const PROOFRAIL_ARD_METADATA = {
  schemaVersion: "org.proofrail.schemaVersion",
  resourceId: "org.proofrail.resourceId",
  resourceKind: "org.proofrail.resourceKind",
  discoveryStatus: "org.proofrail.discovery.status",
  sourceAssurance: "org.proofrail.evidence.sourceAssurance",
  sourceInspection: "org.proofrail.evidence.sourceInspection",
  correspondence: "org.proofrail.evidence.correspondence",
  securityAssessment: "org.proofrail.evidence.securityAssessment",
  canonicalEvidence: "org.proofrail.evidence.canonicalEvidence",
  ardSpecCommit: "org.proofrail.ard.specCommit",
} as const;

export function pinnedArdRawUrl(path: string): string {
  return `https://raw.githubusercontent.com/${ARD_SPEC_REPOSITORY}/${ARD_SPEC_COMMIT}/${path}`;
}
