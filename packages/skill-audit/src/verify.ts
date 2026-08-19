import { compareArtifacts } from "../../core/src/verify.ts";
import { auditSkillPackage } from "./audit.ts";
import { canonicalSkillPackageBytes, summarizeSkillPackage } from "./package.ts";
import type { SkillPackageEntry, SkillVerificationResult } from "./model.ts";
import { validateSkillPackage } from "./validate.ts";

export function verifySkillPackages(input: {
  publisherEntries: readonly SkillPackageEntry[];
  reproducedEntries: readonly SkillPackageEntry[];
  publisherDirectoryName: string;
  reproducedDirectoryName: string;
}): SkillVerificationResult {
  const publisherBytes = canonicalSkillPackageBytes(input.publisherEntries);
  const reproducedBytes = canonicalSkillPackageBytes(input.reproducedEntries);
  return {
    schemaVersion: "1",
    artifactKind: "agent-skill",
    correspondence: compareArtifacts(publisherBytes, reproducedBytes),
    publisherPackage: summarizeSkillPackage(input.publisherEntries),
    reproducedPackage: summarizeSkillPackage(input.reproducedEntries),
    publisherFormat: validateSkillPackage(input.publisherEntries, input.publisherDirectoryName),
    reproducedFormat: validateSkillPackage(input.reproducedEntries, input.reproducedDirectoryName),
    auditTarget: "publisher",
    audit: auditSkillPackage(input.publisherEntries),
  };
}
