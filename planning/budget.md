# Budget

## Known developer-tool budget

- Two ChatGPT accounts at the user's existing paid level.

## External infrastructure policy

**Default allowed spend: $0 until explicitly approved.**

Free/test resources should be used for development where possible. Mainnet transactions and paid infrastructure require explicit approval where applicable.

| Item | Development approach | Spend rule |
|---|---|---|
| Local compute | Existing development environment | $0 incremental |
| GitHub | Existing account | Free/public repo |
| Web hosting | Free tier where adequate | Do not upgrade without need |
| 0G Storage | Test environment first | Measure before mainnet/paid usage |
| 0G Chain | Local/testnet first | Mainnet only after contract gate |
| 0G Sandbox | Short Galileo technical spikes only | Hard-cap testnet funding; delete sandbox after test; record balance deltas |
| AI APIs | None required for core | Do not add in Wave 3 unless justified |

## Measured 0G Chain envelope — M3

The successful Galileo registry dry-run measured deployment gas `299829` and first-registration gas `161123`. At the M3 read-only Aristotle fee snapshot (`4000000007` wei gas price), the estimated combined cost was `0.001843808003226664 0G`.

This was a point-in-time estimate, **not** an approved budget and not a mainnet spend.

## Current Aristotle approval envelope — M5

The read-only M5 gate on 2026-08-17 re-confirmed current mainnet chain ID `16661`, RPC `https://evmrpc.0g.ai`, and queried the network without signing or sending a transaction.

Observed gate:

- wallet: `0x067Ac9bcb6B640bF65a0b17eeE705859c8292Dbb`;
- nonce: `0`;
- balance: `0.0 0G`;
- gas price: `4000000007` wei/gas;
- max-fee snapshot: `4000000014` wei/gas;
- mainnet contract-deployment estimate: `306924` gas;
- proposed deployment limit with 20% safety: `368309` gas;
- Galileo-measured registration gas: `161123`;
- proposed registration limit with 20% safety: `193348` gas;
- combined safety gas: `561657`;
- point-in-time combined fee envelope: `0.002246628007863198 0G`.

The wallet is therefore **not funded** for the proposed mainnet sequence. No mainnet spend is approved or possible from this wallet yet.

A funding amount around `0.003 0G` would exceed this particular snapshot with a modest buffer, but fees/nonce must be refreshed immediately before any approved write. Funding the wallet is not itself authorization for ProofRail to submit the mainnet transactions.

## Measured 0G Sandbox envelope — M4/M5

M4 established the authoritative live provider economics from the on-chain settlement contract:

- create fee: `0.06 0G`;
- CPU: `0.001 0G` per CPU-minute;
- memory: `0.0005 0G` per GB-minute;
- selected snapshot: 1 CPU / 1 GB / 3 GB;
- one-minute CPU+memory rate: `0.0015 0G`.

M5 reused the same disposable Galileo execution wallet and the same provider. The successful M5 runner enforced a `0.07 0G` target and `0.07 0G` hard deposit-delta cap before any Sandbox write. Its funding record shows no new acknowledgement transaction and deposit transaction `0xd5ad54f0a7d7309fb1e2c4c28b8ff320d4bf07c1cf95db0829ade66fd2ec3094` for `0.07` Galileo testnet 0G. The successful sandbox was deleted after the Storage proof completed.

These are testnet-token observations, not fiat costs or production-price guarantees.

## Cost discipline

- No Kubernetes.
- No dedicated database unless the working product requires persistent mutable state.
- No GPU rental.
- No paid monitoring suite.
- No paid AI API solely for demo optics.
- Sandbox execution services default back to read-only after a live spike.
- No Aristotle mainnet transaction until the wallet is funded, the fee gate is refreshed, the exact proposed sequence is presented, and the user explicitly approves it.
