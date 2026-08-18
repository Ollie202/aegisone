import { formatEther, JsonRpcProvider, parseEther, Wallet } from "ethers";
import { SandboxApiClient, discoverBroker, discoverProvider, selectExecutionProvider } from "../../sandbox-0g/src/api.ts";
import { acknowledgeIfNeeded, depositForProvider, inspectSandboxChain, normalizePrivateKey } from "../../sandbox-0g/src/chain.ts";
import { getEvidence, summarizeEvidence } from "../../sandbox-0g/src/tapp.ts";
import { computeRegistryRecordId, readEvidence, registerEvidence } from "../../registry-0g/src/client.ts";
import { decodeCanonicalSkillPackage, readSkillDirectory, summarizeSkillPackage } from "../../skill-audit/src/index.ts";
import { performStorageRoundTrip, ZeroGSdkTransport } from "../../storage-0g/src/index.ts";
import { attachM7StorageEvidence, createM7SkillSlice, type SkillBuildEnvironment, type SkillSourceClaim } from "../src/index.ts";

const SOURCE_REPO = "https://github.com/Ollie202/proofrail-0g.git";
const SOURCE_COMMIT = process.env.PROOFRAIL_M7_SOURCE_COMMIT?.trim() ?? "";
const WRITE_GATE = process.env.PROOFRAIL_M7_GALILEO_WRITE?.trim();
const REQUIRED_GATE = "I_UNDERSTAND_THIS_WRITES_GALILEO_TESTNET";
const SOURCE_PATH = "/tmp/proofrail-m7";
const SKILL_SUBDIRECTORY = "examples/agent-skills/clean-review";
const PACKAGE_PATH = "/tmp/clean-review.skillpkg";
const LOCAL_SKILL_DIRECTORY = SKILL_SUBDIRECTORY;
const GALILEO_RPC = "https://evmrpc-testnet.0g.ai";
const GALILEO_CHAIN_ID = 16602;
const GALILEO_REGISTRY = "0x227Fcc243f25c395C93Df789EC72Bc75bf096017";
const DEPOSIT_TARGET = parseEther("0.07");
const HARD_DEPOSIT_DELTA_CAP = parseEther("0.07");
const GAS_RESERVE = parseEther("0.02");
const BUDGETED_MINUTES = 5n;
const TOOLBOX_READY_ATTEMPTS = 8;
const TOOLBOX_READY_DELAY_MS = 1_500;

if (!/^[0-9a-f]{40}$/.test(SOURCE_COMMIT)) throw new Error("PROOFRAIL_M7_SOURCE_COMMIT must be an exact lowercase 40-character Git commit SHA");
if (WRITE_GATE !== REQUIRED_GATE) throw new Error(`Refusing Galileo writes without PROOFRAIL_M7_GALILEO_WRITE=${REQUIRED_GATE}`);
const railwayCommit = process.env.RAILWAY_GIT_COMMIT_SHA?.trim();
if (railwayCommit && railwayCommit !== SOURCE_COMMIT) {
  throw new Error(`Railway snapshot commit ${railwayCommit} does not match explicit M7 source commit ${SOURCE_COMMIT}`);
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function sandboxId(value: unknown): string {
  const top = object(value);
  if (typeof top.id === "string") return top.id;
  const nested = object(top.sandbox);
  if (typeof nested.id === "string") return nested.id;
  throw new Error(`Sandbox create response did not include an id: ${JSON.stringify(value).slice(0, 1000)}`);
}

function assertExecSucceeded(value: unknown, command: string): void {
  const top = object(value);
  const nested = object(top.result);
  const candidate = Object.keys(nested).length ? nested : top;
  const exitCode = candidate.exitCode ?? candidate.exit_code ?? candidate.code;
  if (typeof exitCode === "number" && exitCode !== 0) throw new Error(`Sandbox command failed (${exitCode}): ${command}`);
  if (typeof exitCode === "string" && /^\d+$/.test(exitCode) && Number(exitCode) !== 0) throw new Error(`Sandbox command failed (${exitCode}): ${command}`);
}

async function waitForToolboxReady(client: SandboxApiClient, id: string): Promise<number> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= TOOLBOX_READY_ATTEMPTS; attempt += 1) {
    try {
      const response = await client.exec(id, "true", 10);
      assertExecSucceeded(response, "true");
      return attempt;
    } catch (error) {
      lastError = error;
      if (attempt === TOOLBOX_READY_ATTEMPTS) break;
      await new Promise((resolve) => setTimeout(resolve, TOOLBOX_READY_DELAY_MS));
    }
  }
  throw new Error(`0G Sandbox toolbox did not become ready: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

function assertCommitmentsEqual(actual: Awaited<ReturnType<typeof readEvidence>>, expected: ReturnType<typeof attachM7StorageEvidence>["preparedAristotleAnchor"]["commitments"]): void {
  if (!actual) throw new Error("Galileo registry record was not readable after registration");
  for (const key of ["manifestDigest", "sourceClaimDigest", "publisherArtifactDigest", "reproducedArtifactDigest", "provenanceRoot"] as const) {
    if (actual[key].toLowerCase() !== expected[key].toLowerCase()) throw new Error(`Galileo registry ${key} readback mismatch`);
  }
}

const storagePrivateKeyRaw = process.env.ZEROG_STORAGE_PRIVATE_KEY?.trim();
if (!storagePrivateKeyRaw) throw new Error("ZEROG_STORAGE_PRIVATE_KEY is required");
const sandboxPrivateKeyRaw = process.env.ZEROG_SANDBOX_PRIVATE_KEY?.trim() || storagePrivateKeyRaw;
const sandboxWallet = new Wallet(normalizePrivateKey(sandboxPrivateKeyRaw));
const publisher = await readSkillDirectory(LOCAL_SKILL_DIRECTORY);
const publisherSummary = summarizeSkillPackage(publisher.entries);

const sourceClaim: SkillSourceClaim = {
  schemaVersion: "1",
  repository: SOURCE_REPO,
  commitSha: SOURCE_COMMIT,
  subdirectory: SKILL_SUBDIRECTORY,
  publisherIdentity: {
    type: "github",
    subject: "Ollie202/proofrail-0g",
    assuranceLevel: "DECLARED",
    evidenceReferences: ["https://github.com/Ollie202/proofrail-0g"],
  },
  packageFormat: "proofrail-agent-skill-package-v1",
};

const output: Record<string, unknown> = {
  schemaVersion: "1",
  artifactKind: "agent-skill",
  ok: false,
  sourceClaim,
  publisherPackage: publisherSummary,
  safety: {
    galileoWritesAuthorized: true,
    galileoChainId: GALILEO_CHAIN_ID,
    galileoRegistry: GALILEO_REGISTRY,
    aristotleMainnetWrites: false,
    mainnetSignerCodePresent: false,
    sandboxDepositTargetWei: DEPOSIT_TARGET.toString(),
    hardSandboxDepositDeltaCapWei: HARD_DEPOSIT_DELTA_CAP.toString(),
    gasReserveWei: GAS_RESERVE.toString(),
  },
};

let createdSandboxId: string | null = null;
let sandboxClient: SandboxApiClient | null = null;
let runError: string | null = null;
let cleanupError: string | null = null;
try {
  const broker = await discoverBroker();
  if (broker.info.chainId !== GALILEO_CHAIN_ID) throw new Error(`Refusing non-Galileo Sandbox broker chain ${broker.info.chainId}`);
  const surfaces = await Promise.all(broker.providers.map(async (listing) => ({ listing, ...(await discoverProvider(listing)) })));
  const selected = selectExecutionProvider(surfaces);
  if (selected.info.sealedOnly) throw new Error("Refusing M7 toolbox packaging on sealed-only provider");
  const pre = await inspectSandboxChain(selected.info, sandboxWallet.address);
  const cpu = BigInt(selected.snapshot.cpu ?? 1);
  const mem = BigInt(selected.snapshot.mem ?? 1);
  const oneMinuteResourceCost = pre.servicePricePerCpuPerMin * cpu + pre.servicePricePerMemGbPerMin * mem;
  const budgetedProviderCost = pre.serviceCreateFee + oneMinuteResourceCost * BUDGETED_MINUTES;
  if (budgetedProviderCost > DEPOSIT_TARGET) throw new Error(`M7 deposit target ${formatEther(DEPOSIT_TARGET)} is below authoritative five-minute provider budget ${formatEther(budgetedProviderCost)}`);
  const depositDelta = DEPOSIT_TARGET > pre.contractBalance ? DEPOSIT_TARGET - pre.contractBalance : 0n;
  if (depositDelta > HARD_DEPOSIT_DELTA_CAP) throw new Error("Required M7 Sandbox deposit exceeds the hard testnet cap");
  if (pre.nativeBalance < depositDelta + GAS_RESERVE) throw new Error("Galileo wallet lacks M7 Sandbox deposit plus gas reserve");

  const acknowledgeTx = await acknowledgeIfNeeded(selected.info, sandboxWallet);
  const depositTx = depositDelta > 0n ? await depositForProvider(selected.info, sandboxWallet, formatEther(depositDelta)) : null;
  output.sandboxFunding = { acknowledgeTx, depositTx, depositedWei: depositDelta.toString() };

  sandboxClient = new SandboxApiClient(selected.listing.url, sandboxWallet);
  const created = await sandboxClient.create({ image: selected.snapshot.name, name: `proofrail-m7-${Date.now()}`, sealed: false });
  createdSandboxId = sandboxId(created);
  output.sandbox = {
    id: createdSandboxId,
    providerAddress: selected.info.providerAddress,
    providerUrl: selected.listing.url,
    snapshot: selected.snapshot,
  };

  const toolboxReadyAttempt = await waitForToolboxReady(sandboxClient, createdSandboxId);
  output.toolboxReadiness = { ready: true, attempt: toolboxReadyAttempt };
  await sandboxClient.gitClone(createdSandboxId, SOURCE_REPO, SOURCE_PATH, SOURCE_COMMIT);
  const headBytes = await sandboxClient.downloadFile(createdSandboxId, `${SOURCE_PATH}/.git/HEAD`);
  const resolvedHead = Buffer.from(headBytes).toString("utf8").trim();
  if (resolvedHead !== SOURCE_COMMIT) throw new Error(`0G Sandbox checkout resolved ${resolvedHead}, expected ${SOURCE_COMMIT}`);

  const commands = [
    "node --version",
    `cd ${SOURCE_PATH} && node --experimental-strip-types packages/skill-audit/scripts/package-dir.ts ${SKILL_SUBDIRECTORY} ${PACKAGE_PATH}`,
    `sha256sum ${PACKAGE_PATH}`,
  ];
  const execResults: Array<{ command: string; response: unknown }> = [];
  for (const command of commands) {
    const response = await sandboxClient.exec(createdSandboxId, command, 60);
    assertExecSucceeded(response, command);
    execResults.push({ command, response });
  }

  const reproducedPackageBytes = await sandboxClient.downloadFile(createdSandboxId, PACKAGE_PATH);
  const reproducedEntries = decodeCanonicalSkillPackage(reproducedPackageBytes);
  const reproducedSummary = summarizeSkillPackage(reproducedEntries);
  if (reproducedSummary.sha256 !== publisherSummary.sha256) {
    throw new Error(`Independent 0G skill package ${reproducedSummary.sha256} does not match publisher package ${publisherSummary.sha256}`);
  }

  const challenge = Buffer.from(reproducedSummary.sha256, "hex");
  const teeEvidence = summarizeEvidence(await getEvidence(pre.teeUrl, pre.appId, challenge), challenge, selected.info.providerAddress);
  const environment: SkillBuildEnvironment = {
    runnerType: "0g",
    network: "0G Galileo Testnet",
    chainId: GALILEO_CHAIN_ID,
    runtime: "node-22",
    sourceCommitSha: SOURCE_COMMIT,
    providerId: selected.info.providerAddress,
    sandboxId: createdSandboxId,
    attestationAvailable: true,
    artifactDigestBoundToAttestation: teeEvidence.challengeBindingProven,
    evidenceReferences: [
      `0g-sandbox:${createdSandboxId}`,
      `0g-provider:${selected.info.providerAddress}`,
      `tdx-evidence-sha256:${teeEvidence.evidenceSha256}`,
    ],
  };

  const slice = createM7SkillSlice({
    sourceClaim,
    environment,
    publisherEntries: publisher.entries,
    reproducedEntries,
    publisherDirectoryName: publisher.directoryName,
    reproducedDirectoryName: publisher.directoryName,
  });
  output.build = {
    exactCommitVerified: true,
    gitHead: resolvedHead,
    commands: execResults,
    reproducedPackage: reproducedSummary,
  };
  output.correspondence = {
    genuine: slice.genuine.verification.correspondence,
    substitutionProbe: slice.substitutionProbe.verification.correspondence,
  };
  output.audit = slice.genuine.verification.audit;
  output.canonicalEvidence = {
    bytes: slice.genuine.canonicalEvidenceBytes.byteLength,
    sha256: slice.genuine.canonicalEvidenceSha256,
  };
  output.attestation = {
    providerTdxEvidence: "PROVEN",
    artifactDigestChallengeBinding: teeEvidence.challengeBindingProven ? "PROVEN" : "NOT_AVAILABLE_ON_LIVE_LEGACY_TAPP",
    artifactComputedInTee: "NOT_AVAILABLE",
    evidence: teeEvidence,
  };

  const storageTransport = new ZeroGSdkTransport({ privateKey: storagePrivateKeyRaw });
  const storage = await performStorageRoundTrip(slice.genuine.canonicalEvidenceBytes, storageTransport);
  const stored = attachM7StorageEvidence(slice, storage);
  output.storage = stored.storage;
  output.preparedAristotleAnchor = stored.preparedAristotleAnchor;

  const registryProvider = new JsonRpcProvider(GALILEO_RPC, GALILEO_CHAIN_ID);
  const registryNetwork = await registryProvider.getNetwork();
  if (Number(registryNetwork.chainId) !== GALILEO_CHAIN_ID) throw new Error(`Refusing registry network ${registryNetwork.chainId}`);
  const registrySigner = new Wallet(normalizePrivateKey(storagePrivateKeyRaw), registryProvider);
  const recordId = computeRegistryRecordId(stored.preparedAristotleAnchor.commitments);
  let record = await readEvidence(registryProvider, GALILEO_REGISTRY, recordId);
  let writeReceipt: Awaited<ReturnType<typeof registerEvidence>> | null = null;
  if (!record) {
    writeReceipt = await registerEvidence(registrySigner, GALILEO_REGISTRY, stored.preparedAristotleAnchor.commitments);
    if (writeReceipt.recordId.toLowerCase() !== recordId.toLowerCase()) throw new Error("Galileo registry write returned unexpected record ID");
    record = await readEvidence(registryProvider, GALILEO_REGISTRY, recordId);
  }
  assertCommitmentsEqual(record, stored.preparedAristotleAnchor.commitments);
  output.galileoRegistry = {
    chainId: GALILEO_CHAIN_ID,
    contractAddress: GALILEO_REGISTRY,
    recordId,
    transactionHash: writeReceipt?.transactionHash ?? null,
    blockNumber: writeReceipt?.blockNumber ?? null,
    gasUsed: writeReceipt?.gasUsed ?? null,
    alreadyRegistered: writeReceipt === null,
    exactReadback: true,
  };
  output.ok = true;
} catch (error) {
  runError = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  output.error = runError;
} finally {
  if (createdSandboxId && sandboxClient) {
    try {
      output.cleanup = { sandboxId: createdSandboxId, deleteResponse: await sandboxClient.delete(createdSandboxId), deleted: true };
    } catch (error) {
      cleanupError = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      output.cleanup = { sandboxId: createdSandboxId, deleted: false, error: cleanupError };
    }
  }
}

console.log(JSON.stringify(output, null, 2));
if (runError || cleanupError || output.ok !== true) process.exitCode = 1;
