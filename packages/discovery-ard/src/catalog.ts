import {
  ARD_CATALOG_SPEC_VERSION,
  ARD_MEDIA_TYPES,
  ARD_SPEC_COMMIT,
  PROOFRAIL_ARD_METADATA,
  PROOFRAIL_ARD_REGISTRY_IDENTIFIER,
} from "./constants.ts";
import type { ArdCatalogManifest } from "./types.ts";
import { assertAbsoluteHttpUrl, assertValidArdCatalogManifest } from "./validate.ts";

function withoutTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function createProofRailArdCatalogManifest(publicBaseUrl: string): ArdCatalogManifest {
  assertAbsoluteHttpUrl(publicBaseUrl, "publicBaseUrl");
  const baseUrl = withoutTrailingSlash(publicBaseUrl);
  const manifest: ArdCatalogManifest = {
    specVersion: ARD_CATALOG_SPEC_VERSION,
    host: {
      displayName: "ProofRail",
      documentationUrl: "https://github.com/Ollie202/proofrail-0g",
    },
    entries: [
      {
        identifier: PROOFRAIL_ARD_REGISTRY_IDENTIFIER,
        displayName: "ProofRail Capability Search",
        type: ARD_MEDIA_TYPES.registry,
        url: `${baseUrl}/search`,
        description: "Deterministic ARD search over ProofRail capability discovery records. Relevance and INDEXED state are not ProofRail verification.",
        tags: ["capability-discovery", "evidence-infrastructure", "proofrail"],
        metadata: {
          [PROOFRAIL_ARD_METADATA.ardSpecCommit]: ARD_SPEC_COMMIT,
        },
      },
    ],
  };

  assertValidArdCatalogManifest(manifest);
  return manifest;
}
