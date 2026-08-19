import { formatEther, parseEther } from "ethers";
import { discoverBroker, discoverProvider } from "../../sandbox-0g/src/api.ts";
import { inspectSandboxChain } from "../../sandbox-0g/src/chain.ts";

const WALLET = "0x067Ac9bcb6B640bF65a0b17eeE705859c8292Dbb";
const GALILEO_CHAIN_ID = 16602;
const DEPOSIT_TARGET = parseEther("0.07");
const GAS_RESERVE = parseEther("0.02");
const BUDGETED_MINUTES = 5n;

const broker = await discoverBroker();
if (broker.info.chainId !== GALILEO_CHAIN_ID) throw new Error(`Expected Galileo ${GALILEO_CHAIN_ID}, got ${broker.info.chainId}`);

const results = [];
for (const listing of broker.providers) {
  try {
    const surface = await discoverProvider(listing);
    const activeSnapshot = surface.snapshots.find((entry) => entry.state === "active") ?? null;
    const chain = await inspectSandboxChain(surface.info, WALLET);
    const cpu = BigInt(activeSnapshot?.cpu ?? 1);
    const mem = BigInt(activeSnapshot?.mem ?? 1);
    const minuteCost = chain.servicePricePerCpuPerMin * cpu + chain.servicePricePerMemGbPerMin * mem;
    const fiveMinuteBudget = chain.serviceCreateFee + minuteCost * BUDGETED_MINUTES;
    const depositDelta = DEPOSIT_TARGET > chain.contractBalance ? DEPOSIT_TARGET - chain.contractBalance : 0n;
    results.push({
      providerAddress: surface.info.providerAddress,
      providerUrl: listing.url,
      sealedOnly: surface.info.sealedOnly,
      activeSnapshot: activeSnapshot ? { id: activeSnapshot.id, name: activeSnapshot.name, cpu: activeSnapshot.cpu, mem: activeSnapshot.mem, disk: activeSnapshot.disk } : null,
      wallet: {
        nativeBalanceWei: chain.nativeBalance.toString(),
        nativeBalanceOg: formatEther(chain.nativeBalance),
      },
      settlement: {
        contractBalanceWei: chain.contractBalance.toString(),
        contractBalanceOg: formatEther(chain.contractBalance),
        pendingRefundWei: chain.pendingRefund.toString(),
        pendingRefundOg: formatEther(chain.pendingRefund),
        refundUnlockAt: chain.refundUnlockAt.toString(),
      },
      pricing: {
        createFeeWei: chain.serviceCreateFee.toString(),
        createFeeOg: formatEther(chain.serviceCreateFee),
        oneMinuteResourceWei: minuteCost.toString(),
        oneMinuteResourceOg: formatEther(minuteCost),
        fiveMinuteBudgetWei: fiveMinuteBudget.toString(),
        fiveMinuteBudgetOg: formatEther(fiveMinuteBudget),
      },
      nextRunAtCurrentTarget: {
        depositTargetWei: DEPOSIT_TARGET.toString(),
        depositDeltaWei: depositDelta.toString(),
        depositDeltaOg: formatEther(depositDelta),
        gasReserveWei: GAS_RESERVE.toString(),
        enoughNative: chain.nativeBalance >= depositDelta + GAS_RESERVE,
      },
    });
  } catch (error) {
    results.push({
      providerAddress: listing.address,
      providerUrl: listing.url,
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    });
  }
}

console.log(JSON.stringify({
  ok: true,
  readOnly: true,
  chainId: GALILEO_CHAIN_ID,
  wallet: WALLET,
  providerCount: broker.providers.length,
  providers: results,
}, null, 2));
