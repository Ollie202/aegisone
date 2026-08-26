export const GITHUB_AGENT_FINDER_PROVIDER_ID = "github-agent-finder" as const;
export const HUGGING_FACE_DISCOVER_PROVIDER_ID = "hugging-face-discover" as const;
export const MCP_OFFICIAL_REGISTRY_PROVIDER_ID = "mcp-official-registry" as const;

export const GITHUB_AGENT_FINDER_ENDPOINT = "https://agentfinder.github.com/api/v1/search" as const;
export const HUGGING_FACE_DISCOVER_ENDPOINT = "https://huggingface-hf-discover.hf.space/search" as const;
export const MCP_OFFICIAL_REGISTRY_BASE_URL = "https://registry.modelcontextprotocol.io" as const;
export const MCP_OFFICIAL_REGISTRY_SERVERS_PATH = "/v0.1/servers" as const;

export const GITHUB_AGENT_FINDER_CONTRACT_REPOSITORY = "ards-project/ard-connectors" as const;
export const GITHUB_AGENT_FINDER_CONTRACT_COMMIT = "53cc4f3a4596cf51482fabeb554d124ca248ed07" as const;

export const HUGGING_FACE_DISCOVER_CONTRACT_REPOSITORY = "huggingface/hf-discover" as const;
export const HUGGING_FACE_DISCOVER_CONTRACT_COMMIT = "49c927439fcaa8f210cfd42186c0641acef579fa" as const;

export const MCP_OFFICIAL_REGISTRY_CONTRACT_REPOSITORY = "modelcontextprotocol/registry" as const;
export const MCP_OFFICIAL_REGISTRY_CONTRACT_COMMIT = "6036804f1c62633b5e7d2927f411a6f4127f148a" as const;

/** Fixed allowlisted upstream origins. No other origin may be requested by this package. */
export const DISCOVERY_PROVIDER_ALLOWED_ORIGINS = [
  "https://agentfinder.github.com",
  "https://huggingface-hf-discover.hf.space",
  MCP_OFFICIAL_REGISTRY_BASE_URL,
] as const;

export const DEFAULT_PROVIDER_TIMEOUT_MS = 3_000;
export const DEFAULT_TOTAL_SEARCH_DEADLINE_MS = 5_000;
export const DEFAULT_MAX_RESPONSE_BYTES = 1_048_576; // 1 MiB
export const DEFAULT_MAX_RESULTS_PER_PROVIDER = 25;

/** MCP Registry-specific bounds for the bounded incremental ingestion sync helper. */
export const MCP_REGISTRY_DEFAULT_PAGE_LIMIT = 50;
export const MCP_REGISTRY_MAX_PAGE_LIMIT = 100;
/** Hard cap on pages fetched in one `runMcpOfficialRegistryIngestion` call, so an ingestion run
 * always terminates and never silently downloads the entire registry in one pass (docs/17
 * Threat M8-015 response amplification). Remaining entries are picked up by the persisted
 * cursor on the next scheduled run. */
export const MCP_REGISTRY_MAX_PAGES_PER_SYNC = 20;
