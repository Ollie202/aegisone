import { createArdWireDiscoveryProvider, type ArdWireProviderConfig } from "./ard-wire-provider.ts";
import { GITHUB_AGENT_FINDER_ENDPOINT, GITHUB_AGENT_FINDER_PROVIDER_ID } from "./constants.ts";
import type { DiscoveryProvider } from "./types.ts";

export interface GithubAgentFinderProviderOptions extends Pick<ArdWireProviderConfig, "timeoutMs" | "maxResponseBytes" | "maxResults" | "fetchImpl" | "allowedOrigins"> {}

/**
 * GitHub Agent Finder discovery provider.
 *
 * Contract reference: `ards-project/ard-connectors@53cc4f3a4596cf51482fabeb554d124ca248ed07`.
 * Endpoint: `POST https://agentfinder.github.com/api/v1/search`. Public, unauthenticated.
 *
 * Live-observed response entries use provider-native `urn:ai:...` identifiers rather than
 * ProofRail's own `urn:air:` catalog convention; normalization in `./normalize.ts` does not
 * assume any particular identifier scheme.
 */
export function createGithubAgentFinderProvider(options: GithubAgentFinderProviderOptions = {}): DiscoveryProvider {
  return createArdWireDiscoveryProvider({
    id: GITHUB_AGENT_FINDER_PROVIDER_ID,
    endpoint: GITHUB_AGENT_FINDER_ENDPOINT,
    ...options,
  });
}
