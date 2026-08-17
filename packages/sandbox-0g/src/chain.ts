import { Contract, JsonRpcProvider, Wallet, getAddress, parseEther } from "ethers";
import type { SandboxInfo } from "./api.ts";

export const GALILEO_CHAIN_ID = 16602n;
export const ARISTOTLE_CHAIN_ID = 16661n;

const SANDBOX_ABI = [
  "function getBalance(address user,address provider) view returns (uint256 balance,uint256 pendingRefund,uint256 refundUnlockAt)",
  "function services(address provider) view returns (string url,string appId,uint256 pricePerCPUPerMin,uint256 pricePerMemGBPerMin,uint256 createFee)",
  "function tappRegistry() view returns (address)",
  "function deposit(address recipient,address provider) payable",
];

export const TAPP_ABI = [
  "function version() view returns (string)",
  "function isAcknowledged(address user,string appId) view returns (bool)",
  "function acknowledgeApp(string appId)",
  "function getAppInfo(string appId) view returns (bytes composeHash,bytes volumesHash,bytes[] imageHashes,address owner,uint256 registeredAt)",
  "function getNode(string appId,address signer) view returns (tuple(string teeUrl,uint256 addedAt,uint256 stakeAmount,bytes composeHash,bytes volumesHash) node)",
];

export async function requireGalileo(provider: JsonRpcProvider): Promise<void> {
  const network = await provider.getNetwork();
  if (network.chainId !== GALILEO_CHAIN_ID) {
    throw new Error(`Refusing sandbox chain write: expected Galileo ${GALILEO_CHAIN_ID}, got ${network.chainId}`);
  }
}

export function normalizePrivateKey(value: string): string {
  const trimmed = value.trim();
  const key = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) throw new TypeError("ZEROG_SANDBOX_PRIVATE_KEY must be a 32-byte hexadecimal private key");
  return key;
}

function isNodeLike(value: any): boolean {
  return Boolean(value)
    && typeof value === "object"
    && value.teeUrl !== undefined
    && value.addedAt !== undefined
    && value.stakeAmount !== undefined
    && value.composeHash !== undefined
    && value.volumesHash !== undefined;
}

export function unwrapNodeResult(value: any): any {
  if (isNodeLike(value)) return value;
  const nested = value?.node ?? value?.[0];
  if (isNodeLike(nested)) return nested;
  throw new TypeError("TappRegistry getNode returned an unexpected NodeInfo shape");
}

export async function inspectSandboxChain(info: SandboxInfo, walletAddress: string): Promise<{
  nativeBalance: bigint;
  contractBalance: bigint;
  pendingRefund: bigint;
  refundUnlockAt: bigint;
  tappRegistry: string;
  tappVersion: string;
  acknowledged: boolean;
  teeUrl: string;
  nodeComposeHash: string;
  nodeVolumesHash: string;
  serviceCreateFee: bigint;
  appId: string;
}> {
  if (BigInt(info.chainId) !== GALILEO_CHAIN_ID) throw new Error(`Sandbox broker is not Galileo: chain ${info.chainId}`);
  const provider = new JsonRpcProvider(info.rpcUrl);
  await requireGalileo(provider);
  const settlement = new Contract(getAddress(info.contractAddress), SANDBOX_ABI, provider);
  const providerAddress = getAddress(info.providerAddress);
  const user = getAddress(walletAddress);
  const [nativeBalance, balanceResult, registryAddress, service] = await Promise.all([
    provider.getBalance(user),
    settlement.getBalance(user, providerAddress),
    settlement.tappRegistry(),
    settlement.services(providerAddress),
  ]);
  const tapp = new Contract(registryAddress, TAPP_ABI, provider);
  const appId = service.appId || info.appId;
  const [acknowledged, nodeResult, tappVersion] = await Promise.all([
    tapp.isAcknowledged(user, appId),
    tapp.getNode(appId, providerAddress),
    tapp.version(),
  ]);
  const node = unwrapNodeResult(nodeResult);
  if (BigInt(node.addedAt) === 0n) throw new Error("Broker provider is not an active TappRegistry node for its appId");
  return {
    nativeBalance,
    contractBalance: BigInt(balanceResult.balance),
    pendingRefund: BigInt(balanceResult.pendingRefund),
    refundUnlockAt: BigInt(balanceResult.refundUnlockAt),
    tappRegistry: getAddress(registryAddress),
    tappVersion: String(tappVersion),
    acknowledged,
    teeUrl: String(node.teeUrl),
    nodeComposeHash: String(node.composeHash),
    nodeVolumesHash: String(node.volumesHash),
    serviceCreateFee: BigInt(service.createFee),
    appId,
  };
}

export async function acknowledgeIfNeeded(info: SandboxInfo, wallet: Wallet): Promise<string | null> {
  const provider = new JsonRpcProvider(info.rpcUrl);
  await requireGalileo(provider);
  const signer = wallet.connect(provider);
  const settlement = new Contract(getAddress(info.contractAddress), SANDBOX_ABI, signer);
  const registryAddress = await settlement.tappRegistry();
  const service = await settlement.services(getAddress(info.providerAddress));
  const tapp = new Contract(registryAddress, TAPP_ABI, signer);
  if (await tapp.isAcknowledged(wallet.address, service.appId)) return null;
  const tx = await tapp.acknowledgeApp(service.appId);
  await tx.wait();
  return tx.hash;
}

export async function depositForProvider(info: SandboxInfo, wallet: Wallet, amountOg: string): Promise<string> {
  const provider = new JsonRpcProvider(info.rpcUrl);
  await requireGalileo(provider);
  const signer = wallet.connect(provider);
  const settlement = new Contract(getAddress(info.contractAddress), SANDBOX_ABI, signer);
  const amount = parseEther(amountOg);
  if (amount <= 0n) throw new TypeError("deposit amount must be positive");
  const tx = await settlement.deposit(wallet.address, getAddress(info.providerAddress), { value: amount });
  await tx.wait();
  return tx.hash;
}
