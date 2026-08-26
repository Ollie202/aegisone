import {
  ARD_CATALOG_SPEC_VERSION,
  ARD_MEDIA_TYPES,
  ARD_SPEC_COMMIT,
  AEGISONE_ARD_METADATA,
  AEGISONE_ARD_REGISTRY_IDENTIFIER,
} from "./constants.ts";
import type { ArdCatalogManifest } from "./types.ts";
import { assertAbsoluteHttpUrl, assertValidArdCatalogManifest } from "./validate.ts";

function withoutTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function createAegisOneArdCatalogManifest(publicBaseUrl: string): ArdCatalogManifest {
  assertAbsoluteHttpUrl(publicBaseUrl, "publicBaseUrl");
  const baseUrl = withoutTrailingSlash(publicBaseUrl);
  const manifest: ArdCatalogManifest = {
    specVersion: ARD_CATALOG_SPEC_VERSION,
    host: {
      displayName: "AegisOne",
      documentationUrl: "https://github.com/Ollie202/aegisone",
    },
    entries: [
      {
        identifier: AEGISONE_ARD_REGISTRY_IDENTIFIER,
        displayName: "AegisOne Capability Search",
        type: ARD_MEDIA_TYPES.registry,
        url: `${baseUrl}/search`,
        description: "Deterministic ARD search over AegisOne capability discovery records. Relevance and INDEXED state are not AegisOne verification.",
        tags: ["capability-discovery", "evidence-infrastructure", "aegisone"],
        metadata: {
          [AEGISONE_ARD_METADATA.ardSpecCommit]: ARD_SPEC_COMMIT,
        },
      },
    ],
  };

  assertValidArdCatalogManifest(manifest);
  return manifest;
}
