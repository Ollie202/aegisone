import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { formatEther, parseEther, Wallet } from "ethers";
import { recipeDigest } from "../../core/src/verify.ts";
import type { BuildEnvironment, BuildRecipe, ReleaseClaim } from "../../core/src/model.ts";
import { SandboxApiClient, discoverBroker, discoverProvider, selectExecutionProvider } from "../../sandbox-0g/src/api.ts";
import { acknowledgeIfNeeded, depositForProvider, inspectSandboxChain, normalizePrivateKey } from "../../sandbox-0g/src/chain.ts";
import { getEvidence, summarizeEvidence } from "../../sandbox-0g/src/tapp.ts";
import { performStorageRoundTrip, ZeroGSdkTransport } from "../../storage-0g/src/index.ts";
import { attachStorageEvidence, createJudgeableSlice } from "../src/index.ts";

const SOURCE_REPO = "https://github.com/Ollie202/aegisone.git";
const SOURCE_COMMIT = "e9c82277cef2f7630977e2473664e14eed2f860d";
const SOURCE_PATH = "/tmp/aegisone-m5";
const FIXTURE_DIR = `${SOURCE_PATH}/examples/hello-proofrail`;
const ARTIFACT_PATH = `${FIXTURE_DIR}/dist/hello-proofrail.json`;
const PUBLISHER_ARTIFACT_PATH = "examples/hello-proofrail/fixtures/publisher/hello-proofrail.json";
const EXPECTED_ARTIFACT_SHA256 = "9978d500ee45216cb6c93b886857100ce95b63f6135dd339ace7ff533d9aa154";
const EXPECTED_ARTIFACT_BYTES = 53;
const DEPOSIT_TARGET = parseEther("0.07");
const HARD_DEPOSIT_DELTA_CAP = parseEther("0.07");
const GAS_RESERVE = parseEther("0.02");
const BUDGETED_MINUTES = 5n;

const recipe: BuildRecipe = {
  version: "1",
  runtime: "node-22",
  workingDirectory: "examples/hello-proofrail",
  commands: [{ executable: "node", args: ["build.mjs"] }],
  artifactPath: "dist/hello-proofrail.json",
  networkPolicy: "none",
  resourceLimits: { timeoutMs: 60_000, maxOutputBytes: 1_024 },
  environment: {},
};
const claim: ReleaseClaim = {
  claimVersion: "1",
  projectId: "hello-proofrail@1.0.0",
  publisherIdentity: {
    type: "github",
    subject: "Ollie202/aegisone",
    assuranceLevel: "DECLARED",
    evidenceReferences: ["https://github.com/Ollie202/aegisone"],
  },
  source: { provider: "git", repository: SOURCE_REPO, commitSha: SOURCE_COMMIT },
  recipeDigest: recipeDigest(recipe),
  artifactName: "hello-proofrail.json",
  artifactLocation: PUBLISHER_ARTIFACT_PATH,
  releaseTag: "v1.0.0-demo",
  claimAssuranceLevel: "DECLARED",
};

const commands = [
  "node --version",
  `cd ${FIXTURE_DIR} && node build.mjs`,
  `sha256sum ${ARTIFACT_PATH}`,
];

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function sandboxId(value: unknown): string {
  const top = record(value);
  if (typeof top.id === "string") return top.id;
  const nested = record(top.sandbox);
  if (typeof nested.id === "string") return nested.id;
  throw new Error(`Sandbox create response did not include an id: ${JSON.stringify(value).slice(0, 1000)}`);
}

function assertExecSucceeded(value: unknown, command: string): void {
  const top = record(value);
  const nested = record(top.result);
  const candidate = Object.keys(nested).length ? nested : top;
  const exitCode = candidate.exitCode ?? candidate.exit_code ?? candidate.code;
  if (typeof exitCode === "number" && exitCode !== 0) throw new Error(`Sandbox command failed (${exitCode}): ${command}`);
  if (typeof exitCode === "string" && /^\d+$/.test(exitCode) && Number(exitCode) !== 0) throw new Error(`Sandbox command failed (${exitCode}): ${command}`);
}

const sandboxPrivateKeyRaw = process.env.ZEROG_SANDBOX_PRIVATE_KEY?.trim();
if (!sandboxPrivateKeyRaw) throw new Error("ZEROG_SANDBOX_PRIVATE_KEY is required");
const storagePrivateKeyRaw = process.env.ZEROG_STORAGE_PRIVATE_KEY?.trim() || sandboxPrivateKeyRaw;
const wallet = new Wallet(normalizePrivateKey(sandboxPrivateKeyRaw));
const publisherBytes = new Uint8Array(await readFile(PUBLISHER_ARTIFACT_PATH));
const publisherSha256 = createHash("sha256").update(publisherBytes).digest("hex");
if (publisherBytes.byteLength !== EXPECTED_ARTIFACT_BYTES || publisherSha256 !== EXPECTED_ARTIFACT_SHA256) {
  throw new Error("Checked-in publisher artifact no longer matches the explicit M5 demo claim");
}

const broker = await discoverBroker();
if (broker.info.chainId !== 16602) throw new Error(`Refusing non-Galileo Sandbox broker chain ${broker.info.chainId}`);
const surfaces = await Promise.all(broker.providers.map(async (listing) => ({ listing, ...(await discoverProvider(listing)) })));
const selected = selectExecutionProvider(surfaces);
if (selected.info.sealedOnly) throw new Error("Refusing M5 toolbox build on sealed-only provider");
const pre = await inspectSandboxChain(selected.info, wallet.address);
const cpu = BigInt(selected.snapshot.cpu ?? 1);
const mem = BigInt(selected.snapshot.mem ?? 1);
const oneMinuteResourceCost = pre.servicePricePerCpuPerMin * cpu + pre.servicePricePerMemGbPerMin * mem;
const budgetedProviderCost = pre.serviceCreateFee + oneMinuteResourceCost * BUDGETED_MINUTES;
if (budgetedProviderCost > DEPOSIT_TARGET) {
  throw new Error(`M5 deposit target ${formatEther(DEPOSIT_TARGET)} is below authoritative five-minute provider budget ${formatEther(budgetedProviderCost)}`);
}
const depositDelta = DEPOSIT_TARGET > pre.contractBalance ? DEPOSIT_TARGET - pre.contractBalance : 0n;
if (depositDelta > HARD_DEPOSIT_DELTA_CAP) throw new Error("Required M5 Sandbox deposit exceeds the hard testnet cap");
if (pre.nativeBalance < depositDelta + GAS_RESERVE) throw new Error("Disposable Galileo wallet lacks M5 Sandbox deposit plus gas reserve");

const output: Record<string, unknown> = {
  schemaVersion: "1",
  ok: false,
  network: { sandboxChainId: broker.info.chainId, sandboxRpcUrl: broker.info.rpcUrl, storageChainId: 16602 },
  sourceClaim: claim,
  recipe,
  publisherArtifact: { path: PUBLISHER_ARTIFACT_PATH, bytes: publisherBytes.byteLength, sha256: publisherSha256 },
  safety: {
    sandboxDepositTargetWei: DEPOSIT_TARGET.toString(),
    hardSandboxDepositDeltaCapWei: HARD_DEPOSIT_DELTA_CAP.toString(),
    gasReserveWei: GAS_RESERVE.toString(),
    aristotleMainnetWrites: false,
    mainnetSignerCodePresent: false,
  },
};

let id: string | null = null;
let runError: string | null = null;
let cleanupError: string | null = null;
try {
  const acknowledgeTx = await acknowledgeIfNeeded(selected.info, wallet);
  const depositTx = depositDelta > 0n ? await depositForProvider(selected.info, wallet, formatEther(depositDelta)) : null;
  output.sandboxFunding = { acknowledgeTx, depositTx, depositedWei: depositDelta.toString() };

  const client = new SandboxApiClient(selected.listing.url, wallet);
  const created = await client.create({ image: selected.snapshot.name, name: `aegisone-m5-${Date.now()}`, sealed: false });
  id = sandboxId(created);
  output.sandbox = { id, providerAddress: selected.info.providerAddress, providerUrl: selected.listing.url, snapshot: selected.snapshot };

  await client.gitClone(id, SOURCE_REPO, SOURCE_PATH, SOURCE_COMMIT);
  const headBytes = await client.downloadFile(id, `${SOURCE_PATH}/.git/HEAD`);
  const resolvedHead = Buffer.from(headBytes).toString("utf8").trim();
  if (resolvedHead !== SOURCE_COMMIT) throw new Error(`0G Sandbox checkout resolved ${resolvedHead}, expected ${SOURCE_COMMIT}`);

  const execResults: Array<{ command: string; response: unknown }> = [];
  for (const command of commands) {
    const response = await client.exec(id, command, 60);
    assertExecSucceeded(response, command);
    execResults.push({ command, response });
  }
  output.build = { exactCommitVerified: true, gitHead: resolvedHead, commands: execResults };

  const reproducedBytes = await client.downloadFile(id, ARTIFACT_PATH);
  const reproducedSha256 = createHash("sha256").update(reproducedBytes).digest("hex");
  if (reproducedBytes.byteLength !== EXPECTED_ARTIFACT_BYTES || reproducedSha256 !== EXPECTED_ARTIFACT_SHA256) {
    throw new Error("Independent 0G build output did not match the known deterministic fixture output");
  }

  const challenge = Buffer.from(reproducedSha256, "hex");
  const teeEvidence = summarizeEvidence(await getEvidence(pre.teeUrl, pre.appId, challenge), challenge, selected.info.providerAddress);
  const environment: BuildEnvironment = {
    runnerType: "0g",
    runtime: "node-22",
    sourceCommitSha: SOURCE_COMMIT,
    providerId: selected.info.providerAddress,
    attestationAvailable: true,
    artifactDigestBoundToAttestation: teeEvidence.challengeBindingProven,
    evidenceReferences: [
      `0g-sandbox:${id}`,
      `0g-provider:${selected.info.providerAddress}`,
      `tdx-evidence-sha256:${teeEvidence.evidenceSha256}`,
    ],
  };

  const slice = createJudgeableSlice({ claim, recipe, publisherBytes, reproducedBytes, environment });
  output.correspondence = {
    genuine: slice.genuine.view,
    substitutionProbe: slice.substitutionProbe.view,
  };
  output.verification = slice.genuine.verification;
  output.canonicalEvidence = {
    sha256: slice.genuine.canonicalEvidenceSha256,
    bytes: slice.genuine.canonicalEvidenceBytes.byteLength,
  };
  output.attestation = {
    providerTdxEvidence: "PROVEN",
    artifactDigestChallengeBinding: teeEvidence.challengeBindingProven ? "PROVEN" : "NOT_AVAILABLE_ON_LIVE_LEGACY_TAPP",
    artifactComputedInTee: "NOT_AVAILABLE",
    evidence: teeEvidence,
  };

  const storageTransport = new ZeroGSdkTransport({ privateKey: storagePrivateKeyRaw });
  const storage = await performStorageRoundTrip(slice.genuine.canonicalEvidenceBytes, storageTransport);
  const stored = attachStorageEvidence(slice, storage);
  output.storage = stored.storage;
  output.preparedRegistryAnchor = stored.preparedRegistryAnchor;
  output.ok = true;
} catch (error) {
  runError = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  output.error = runError;
} finally {
  if (id) {
    try {
      const client = new SandboxApiClient(selected.listing.url, wallet);
      output.cleanup = { sandboxId: id, deleteResponse: await client.delete(id), deleted: true };
    } catch (error) {
      cleanupError = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      output.cleanup = { sandboxId: id, deleted: false, error: cleanupError };
    }
  }
}

console.log(JSON.stringify(output, null, 2));
if (runError || cleanupError || output.ok !== true) process.exitCode = 1;
