import { readFile } from "node:fs/promises";
import type { BuildRecipe, ReleaseClaim, VerificationJson } from "../../core/src/model.ts";
import { createVerification } from "../../core/src/verify.ts";
import { runLocalBuild } from "../../runner-local/src/run.ts";

export async function verifyLocalRelease(input: {
  claim: ReleaseClaim;
  recipe: BuildRecipe;
  publisherArtifactPath: string;
  sourceRepositoryPath: string;
}): Promise<VerificationJson> {
  const [publisherBytes, build] = await Promise.all([
    readFile(input.publisherArtifactPath),
    runLocalBuild({ source: input.claim.source, recipe: input.recipe, repositoryPath: input.sourceRepositoryPath }),
  ]);
  return createVerification({
    claim: input.claim,
    recipe: input.recipe,
    publisherBytes,
    reproducedBytes: build.artifactBytes,
    environment: build.environment,
  });
}
