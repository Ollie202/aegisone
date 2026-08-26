import type { CapabilityResource } from "../../capability-model/src/model.ts";

function normalizeUrlKey(url: string): string | null {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    let pathname = parsed.pathname;
    if (pathname.length > 1 && pathname.endsWith("/")) pathname = pathname.slice(0, -1);
    return `${parsed.protocol}//${parsed.host.toLowerCase()}${pathname.toLowerCase()}${parsed.search}`;
  } catch {
    return null;
  }
}

function dedupeKey(resource: CapabilityResource): string {
  const urlKey = normalizeUrlKey(resource.discovery.resourceUrl);
  if (urlKey !== null) return `url:${urlKey}`;
  return `name:${resource.kind}:${resource.name.trim().toLowerCase()}`;
}

/**
 * Deterministically deduplicates normalized resources across providers.
 *
 * Input order is significant and must already reflect the desired provider priority (e.g. the
 * caller's configured provider order, then each provider's own returned order): the first
 * resource seen for a given dedupe key is kept and all later duplicates for that key are
 * dropped. This keeps attribution stable (the retained resource keeps its original
 * `discovery.source`/`discovery.sourceResourceId`) without averaging or re-ranking relevance
 * scores across providers, which are not globally calibrated.
 */
export function dedupeCapabilityResources(resources: readonly CapabilityResource[]): CapabilityResource[] {
  const seen = new Set<string>();
  const output: CapabilityResource[] = [];
  for (const resource of resources) {
    const key = dedupeKey(resource);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(resource);
  }
  return output;
}
