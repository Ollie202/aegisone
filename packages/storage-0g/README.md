# @proofrail/storage-0g

Real 0G Storage adapter for canonical ProofRail evidence. This package is intentionally separate from `packages/core`.

Pinned integration:

- `@0gfoundation/0g-storage-ts-sdk@1.2.9`
- `ethers@6.13.1`
- 0G Galileo chain ID `16602`
- development RPC `https://evmrpc-testnet.0g.ai`
- Turbo indexer `https://indexer-storage-testnet-turbo.0g.ai`

The live command independently rebuilds the M1 fixture, serializes its canonical provenance manifest, calculates the 0G Merkle root, performs a real testnet upload, captures root/transaction identifiers, retrieves with SDK proof verification enabled, and requires exact byte equality.

```bash
pnpm --filter @proofrail/storage-0g test:live
```

It requires `ZEROG_STORAGE_PRIVATE_KEY` to be supplied through a secure execution environment. Never put a private key in a command, committed `.env`, log, issue, PR, provenance record, or chat message.

## Railway live run

The repository-level `railway.json` configures a one-shot Railway service. It installs the workspace dependencies, runs `pnpm m2:live`, and does not restart after the command exits.

1. Create a Railway service from this GitHub repository and select the M2 branch while it is under review.
2. In the service **Variables** tab, add `ZEROG_STORAGE_PRIVATE_KEY` with the private key of a disposable, funded Galileo-only wallet. Seal the variable if Railway offers that option.
3. Review and deploy the staged changes once. Do not configure a public domain; this job does not serve HTTP traffic.
4. The final stdout line is the structured round-trip evidence. ProofRail writes a structured failure to stderr when the run fails; SDK console output is suppressed to avoid leaking signer internals.

The live process validates Galileo chain ID `16602` before upload and never includes the private key in its output. A successful Railway deployment is not enough by itself: the returned root and transaction must be inspected and recorded in `hackathon/evidence.md` before M2 is marked complete.

The normal unit tests use a transport contract test double to exercise deterministic orchestration and failures. They are not presented as live 0G evidence. M2 is complete only after the live command produces inspectable Galileo roots and transactions recorded in `hackathon/evidence.md`.
