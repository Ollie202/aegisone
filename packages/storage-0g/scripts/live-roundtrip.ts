import { canonicalBytes, canonicalJson } from "../../core/src/canonical.ts";
import { createVerification } from "../../core/src/verify.ts";
import { runLocalBuild } from "../../runner-local/src/run.ts";
import { makeHelloProofRailFixture } from "../../../examples/hello-proofrail/fixture.ts";
import { performStorageRoundTrip } from "../src/roundtrip.ts";
import { StorageRoundTripError, type StorageRoundTripEvidence } from "../src/types.ts";

async function main(): Promise<void> {
  const privateKey = process.env.ZEROG_STORAGE_PRIVATE_KEY;
  if (!privateKey) {
    throw new StorageRoundTripError(
      "OWNER_ACTION_REQUIRED",
      "configuration",
      "Owner action required: configure a funded Galileo test wallet as ZEROG_STORAGE_PRIVATE_KEY",
      false,
    );
  }

  // Delay SDK loading until configuration is present so offline tests do not pretend to exercise the network.
  const { ZeroGSdkTransport } = await import("../src/sdk.ts");
  const fixture = await makeHelloProofRailFixture();
  try {
    const build = await runLocalBuild({
      source: fixture.claim.source,
      recipe: fixture.recipe,
      repositoryPath: fixture.repositoryPath,
    });
    const verification = createVerification({
      claim: fixture.claim,
      recipe: fixture.recipe,
      publisherBytes: fixture.publisherBytes,
      reproducedBytes: build.artifactBytes,
      environment: build.environment,
    });
    if (verification.correspondence.status !== "MATCH") {
      throw new Error("Refusing to upload evidence for a non-matching reproduction");
    }
    const originalLog = console.log;
    const originalError = console.error;
    // The SDK is noisy. Suppress its console output so a future SDK release cannot
    // accidentally serialize signer state into Railway logs. Structured ProofRail
    // success/failure output is emitted after the SDK call completes.
    console.log = () => {};
    console.error = () => {};
    let evidence: StorageRoundTripEvidence;
    try {
      evidence = await performStorageRoundTrip(
        canonicalBytes(verification.manifest),
        new ZeroGSdkTransport({ privateKey }),
      );
    } finally {
      console.log = originalLog;
      console.error = originalError;
    }
    process.stdout.write(canonicalJson(evidence) + "\n");
  } finally {
    await fixture.cleanup();
  }
}

main().catch((error: unknown) => {
  const output = error instanceof StorageRoundTripError
    ? error.toJSON()
    : { name: "Error", message: error instanceof Error ? error.message : String(error) };
  process.stderr.write(JSON.stringify(output) + "\n");
  process.exitCode = 1;
});
