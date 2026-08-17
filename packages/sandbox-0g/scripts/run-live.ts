import { createHash } from "node:crypto";
import { formatEther, parseEther, Wallet } from "ethers";
import { SandboxApiClient, discoverBroker, discoverProvider, selectExecutionProvider } from "../src/api.ts";
import { acknowledgeIfNeeded, depositForProvider, inspectSandboxChain, normalizePrivateKey } from "../src/chain.ts";
import { getEvidence, summarizeEvidence } from "../src/tapp.ts";

const SOURCE_REPO = "https://github.com/Ollie202/proofrail-0g.git";
const SOURCE_COMMIT = "e9c82277cef2f7630977e2473664e14eed2f860d";
const SOURCE_PATH = "/tmp/proofrail-m4";
const EXPECTED_ARTIFACT_SHA256 = "9978d500ee45216cb6c93b886857100ce95b63f6135dd339ace7ff533d9aa154";
const EXPECTED_ARTIFACT_BYTES = 53;
const ARTIFACT_PATH = `${SOURCE_PATH}/examples/hello-proofrail/dist/hello-proofrail.json`;
const DEPOSIT_TARGET = parseEther("0.07");
const HARD_DEPOSIT_CAP = parseEther("0.08");
const GAS_RESERVE = parseEther("0.02");
const BUDGETED_MINUTES = 5n;

const commands = [
  "node --version",
  `node ${SOURCE_PATH}/examples/hello-proofrail/build.mjs`,
  `sha256sum ${ARTIFACT_PATH}`,
];
const cloneRequest = { url: SOURCE_REPO, path: SOURCE_PATH, commit_id: SOURCE_COMMIT };

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

const privateKeyRaw = process.env.ZEROG_SANDBOX_PRIVATE_KEY?.trim();
if (!privateKeyRaw) throw new Error("ZEROG_SANDBOX_PRIVATE_KEY is required");
if (DEPOSIT_TARGET > HARD_DEPOSIT_CAP) throw new Error("Configured deposit exceeds hard M4 cap");

const wallet = new Wallet(normalizePrivateKey(privateKeyRaw));
const broker = await discoverBroker();
if (broker.info.chainId !== 16602) throw new Error(`Refusing non-Galileo broker chain ${broker.info.chainId}`);
const surfaces = await Promise.all(broker.providers.map(async (listing) => ({ listing, ...(await discoverProvider(listing)) })));
const selected = selectExecutionProvider(surfaces);
if (selected.info.sealedOnly) throw new Error("Refusing paid M4 toolbox run on sealed-only provider");
const pre = await inspectSandboxChain(selected.info, wallet.address);
const cpu = BigInt(selected.snapshot.cpu ?? 1);
const mem = BigInt(selected.snapshot.mem ?? 1);
const oneMinuteResourceCost = pre.servicePricePerCpuPerMin * cpu + pre.servicePricePerMemGbPerMin * mem;
const budgetedProviderCost = pre.serviceCreateFee + oneMinuteResourceCost * BUDGETED_MINUTES;
if (budgetedProviderCost > DEPOSIT_TARGET) throw new Error(`M4 deposit target ${formatEther(DEPOSIT_TARGET)} is below five-minute authoritative provider budget ${formatEther(budgetedProviderCost)}`);
const depositDelta = DEPOSIT_TARGET > pre.contractBalance ? DEPOSIT_TARGET - pre.contractBalance : 0n;
if (depositDelta > HARD_DEPOSIT_CAP) throw new Error("Required M4 deposit delta exceeds hard cap");
if (pre.nativeBalance < depositDelta + GAS_RESERVE) throw new Error("Disposable Galileo wallet lacks deposit plus gas reserve");

const output: Record<string, unknown> = {
  ok: false,
  network: { chainId: broker.info.chainId, rpcUrl: broker.info.rpcUrl },
  wallet: { address: wallet.address, nativeBalanceBeforeWei: pre.nativeBalance.toString() },
  provider: {
    address: selected.info.providerAddress,
    url: selected.listing.url,
    appId: pre.appId,
    sealedOnly: selected.info.sealedOnly,
    snapshot: selected.snapshot,
    onchainCreateFeeWei: pre.serviceCreateFee.toString(),
    onchainPricePerCpuPerMinWei: pre.servicePricePerCpuPerMin.toString(),
    onchainPricePerMemGbPerMinWei: pre.servicePricePerMemGbPerMin.toString(),
    oneMinuteResourceCostWei: oneMinuteResourceCost.toString(),
    budgetedMinutes: BUDGETED_MINUTES.toString(),
    budgetedProviderCostWei: budgetedProviderCost.toString(),
  },
  safety: { depositTargetWei: DEPOSIT_TARGET.toString(), hardDepositCapWei: HARD_DEPOSIT_CAP.toString(), gasReserveWei: GAS_RESERVE.toString(), mainnetWrites: false },
  source: { repository: SOURCE_REPO, commit: SOURCE_COMMIT, cloneTransport: "Daytona toolbox git/clone", cloneRequest, commands },
};

let id: string | null = null;
let runError: string | null = null;
let cleanupError: string | null = null;
try {
  const acknowledgeTx = await acknowledgeIfNeeded(selected.info, wallet);
  const depositTx = depositDelta > 0n ? await depositForProvider(selected.info, wallet, formatEther(depositDelta)) : null;
  output.transactions = { acknowledgeTx, depositTx, depositedWei: depositDelta.toString() };

  const client = new SandboxApiClient(selected.listing.url, wallet);
  const created = await client.create({ image: selected.snapshot.name, name: `proofrail-m4-${Date.now()}`, sealed: false });
  id = sandboxId(created);
  output.sandbox = { id, createResponse: created };

  const cloneResponse = await client.gitClone(id, SOURCE_REPO, SOURCE_PATH, SOURCE_COMMIT);
  const headBytes = await client.downloadFile(id, `${SOURCE_PATH}/.git/HEAD`);
  const resolvedHead = Buffer.from(headBytes).toString("utf8").trim();
  if (resolvedHead !== SOURCE_COMMIT) throw new Error(`Toolbox clone did not leave detached HEAD at requested commit: ${resolvedHead}`);
  output.clone = { request: cloneRequest, response: cloneResponse, gitHead: resolvedHead, exactCommitVerified: true };

  const execResults: Array<{ command: string; response: unknown }> = [];
  for (const command of commands) {
    const response = await client.exec(id, command, 60);
    assertExecSucceeded(response, command);
    execResults.push({ command, response });
  }
  output.exec = execResults;

  const artifact = await client.downloadFile(id, ARTIFACT_PATH);
  const artifactHash = createHash("sha256").update(artifact).digest("hex");
  const artifactMatches = artifact.length === EXPECTED_ARTIFACT_BYTES && artifactHash === EXPECTED_ARTIFACT_SHA256;
  output.artifact = {
    path: ARTIFACT_PATH,
    bytes: artifact.length,
    sha256: artifactHash,
    expectedBytes: EXPECTED_ARTIFACT_BYTES,
    expectedSha256: EXPECTED_ARTIFACT_SHA256,
    matchesExpected: artifactMatches,
    utf8: Buffer.from(artifact).toString("utf8"),
  };
  if (!artifactMatches) throw new Error("Retrieved M4 artifact bytes do not match the deterministic expected output");

  const challenge = Buffer.from(artifactHash, "hex");
  const evidence = summarizeEvidence(await getEvidence(pre.teeUrl, pre.appId, challenge), challenge, selected.info.providerAddress);
  output.attestation = {
    providerTeeUrl: pre.teeUrl,
    providerNodeComposeHash: pre.nodeComposeHash,
    providerNodeVolumesHash: pre.nodeVolumesHash,
    evidence,
    providerTdxEvidence: "PROVEN",
    artifactDigestChallengeBinding: evidence.challengeBindingProven ? "PROVEN" : "NOT_AVAILABLE_ON_LIVE_LEGACY_TAPP",
    artifactComputedInTee: "NOT_AVAILABLE",
    rationale: "The public toolbox build runs in a non-sealed sandbox. The live Galileo Tapp returns real TDX evidence, but its quote v5 report_data is the legacy provider-signer padding and does not bind the caller artifact digest.",
  };
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

try {
  await new Promise((resolve) => setTimeout(resolve, 5_000));
  const post = await inspectSandboxChain(selected.info, wallet.address);
  const settledProviderSpend = pre.contractBalance + depositDelta >= post.contractBalance ? pre.contractBalance + depositDelta - post.contractBalance : 0n;
  output.cost = {
    contractBalanceBeforeWei: pre.contractBalance.toString(),
    contractBalanceAfterWei: post.contractBalance.toString(),
    observedSettledProviderSpendWei: settledProviderSpend.toString(),
    observedSettledProviderSpendOg: formatEther(settledProviderSpend),
    nativeBalanceAfterWei: post.nativeBalance.toString(),
    settlementObservedAfterSeconds: 5,
    note: "Provider voucher settlement may lag; zero/partial observed spend is not treated as final until a later read-only balance check.",
  };
} catch (error) {
  output.cost = { inspectionError: error instanceof Error ? error.message : String(error) };
}

console.log(JSON.stringify(output, null, 2));
if (runError || cleanupError || output.ok !== true) process.exitCode = 1;
