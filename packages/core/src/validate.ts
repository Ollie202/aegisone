import { isSha256 } from "./hash.ts";
import type { BuildRecipe, ReleaseClaim } from "./model.ts";

function requireText(value: string, field: string): void {
  if (value.trim().length === 0) throw new TypeError(`${field} must not be empty`);
}

export function validateReleaseClaim(claim: ReleaseClaim): void {
  if (claim.claimVersion !== "1") throw new TypeError("Unsupported claimVersion");
  requireText(claim.projectId, "projectId");
  requireText(claim.publisherIdentity.subject, "publisherIdentity.subject");
  requireText(claim.source.repository, "source.repository");
  requireText(claim.artifactName, "artifactName");
  if (!/^[0-9a-f]{40}$/.test(claim.source.commitSha)) {
    throw new TypeError("source.commitSha must be a full lowercase 40-character Git SHA-1");
  }
  if (!isSha256(claim.recipeDigest)) throw new TypeError("recipeDigest must be a lowercase SHA-256");
  if (claim.claimAssuranceLevel !== claim.publisherIdentity.assuranceLevel) {
    throw new TypeError("Claim assurance must equal the supplied publisher identity assurance");
  }
}

export function validateBuildRecipe(recipe: BuildRecipe): void {
  if (recipe.version !== "1") throw new TypeError("Unsupported recipe version");
  requireText(recipe.runtime, "runtime");
  if (recipe.workingDirectory.startsWith("/") || recipe.workingDirectory.includes("..")) {
    throw new TypeError("workingDirectory must be a safe relative path");
  }
  if (recipe.artifactPath.startsWith("/") || recipe.artifactPath.split(/[\\/]/).includes("..")) {
    throw new TypeError("artifactPath must be a safe relative path");
  }
  if (recipe.commands.length === 0) throw new TypeError("At least one build command is required");
  for (const command of recipe.commands) {
    requireText(command.executable, "command.executable");
    if (command.executable.includes("/") || command.executable.includes("\\")) {
      throw new TypeError("command.executable must be a bare executable name");
    }
  }
  if (recipe.networkPolicy !== "none") throw new TypeError("M1 only supports networkPolicy=none");
  if (!Number.isInteger(recipe.resourceLimits.timeoutMs) || recipe.resourceLimits.timeoutMs <= 0) {
    throw new TypeError("timeoutMs must be a positive integer");
  }
  if (!Number.isInteger(recipe.resourceLimits.maxOutputBytes) || recipe.resourceLimits.maxOutputBytes <= 0) {
    throw new TypeError("maxOutputBytes must be a positive integer");
  }
}
