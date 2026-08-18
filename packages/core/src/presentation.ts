import { canonicalBytes } from "./canonical.ts";
import { sha256Bytes } from "./hash.ts";
import type { BuildRecipe, CorrespondenceStatus, SourceAssuranceLevel, VerificationJson } from "./model.ts";

export type AttestationClassification = "NOT_AVAILABLE" | "PROVIDER_EVIDENCE_ONLY" | "OUTPUT_DIGEST_BOUND";

export interface VerificationView {
  schemaVersion: "1";
  verdict: CorrespondenceStatus;
  headline: string;
  sourceClaim: {
    assuranceLevel: SourceAssuranceLevel;
    repository: string;
    commitSha: string;
  };
  build: {
    runnerType: "local" | "0g";
    independent0gRebuild: boolean;
    runtime: string;
    providerId: string | null;
    attestation: AttestationClassification;
  };
  artifacts: {
    publisher: { name: string; size: number; sha256: string };
    reproduced: { name: string; size: number; sha256: string };
  };
  recipe: BuildRecipe;
  manifestSha256: string;
  evidenceReferences: string[];
  warnings: string[];
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function assertVerificationIntegrity(value: VerificationJson): void {
  if (value.schemaVersion !== "1" || value.manifest.schemaVersion !== "1") {
    throw new TypeError("Unsupported verification schema version");
  }
  const recomputedManifest = sha256Bytes(canonicalBytes(value.manifest));
  if (recomputedManifest !== value.manifestSha256) {
    throw new TypeError("Verification manifest digest does not match canonical manifest bytes");
  }
  if (
    value.sourceClaim.assuranceLevel !== value.manifest.releaseClaim.claimAssuranceLevel ||
    value.sourceClaim.repository !== value.manifest.releaseClaim.source.repository ||
    value.sourceClaim.commitSha !== value.manifest.releaseClaim.source.commitSha
  ) {
    throw new TypeError("Top-level source claim does not match the canonical manifest");
  }
  if (
    value.artifacts.publisher.sha256 !== value.manifest.publisherArtifact.sha256 ||
    value.artifacts.publisher.size !== value.manifest.publisherArtifact.size ||
    value.artifacts.reproduced.sha256 !== value.manifest.reproducedArtifact.sha256 ||
    value.artifacts.reproduced.size !== value.manifest.reproducedArtifact.size
  ) {
    throw new TypeError("Top-level artifact summary does not match the canonical manifest");
  }
  if (!sameJson(value.correspondence, value.manifest.comparison)) {
    throw new TypeError("Top-level correspondence result does not match the canonical manifest");
  }
}

function headline(status: CorrespondenceStatus): string {
  switch (status) {
    case "MATCH": return "Publisher artifact matches the independent reproduction";
    case "MISMATCH": return "Publisher artifact does not match the independent reproduction";
    case "DIVERGED": return "Reproduction diverged before a byte-for-byte verdict";
    case "INSUFFICIENT_EVIDENCE": return "There is not enough evidence for a correspondence verdict";
  }
}

function attestation(value: VerificationJson): AttestationClassification {
  const environment = value.manifest.environment;
  if (!environment.attestationAvailable) return "NOT_AVAILABLE";
  return environment.artifactDigestBoundToAttestation ? "OUTPUT_DIGEST_BOUND" : "PROVIDER_EVIDENCE_ONLY";
}

export function createVerificationView(value: VerificationJson): VerificationView {
  assertVerificationIntegrity(value);
  const environment = value.manifest.environment;
  const classification = attestation(value);
  const warnings = [...value.correspondence.warnings];
  if (classification === "PROVIDER_EVIDENCE_ONLY") {
    warnings.push("TEE/provider evidence is available, but the reproduced artifact digest is not bound to that attestation.");
  }
  return {
    schemaVersion: "1",
    verdict: value.correspondence.status,
    headline: headline(value.correspondence.status),
    sourceClaim: { ...value.sourceClaim },
    build: {
      runnerType: environment.runnerType,
      independent0gRebuild: environment.runnerType === "0g",
      runtime: environment.runtime,
      providerId: environment.providerId,
      attestation: classification,
    },
    artifacts: {
      publisher: {
        name: value.artifacts.publisher.name,
        size: value.artifacts.publisher.size,
        sha256: value.artifacts.publisher.sha256,
      },
      reproduced: {
        name: value.artifacts.reproduced.name,
        size: value.artifacts.reproduced.size,
        sha256: value.artifacts.reproduced.sha256,
      },
    },
    recipe: value.manifest.recipe,
    manifestSha256: value.manifestSha256,
    evidenceReferences: [...value.manifest.evidenceReferences, ...environment.evidenceReferences],
    warnings,
  };
}
