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

The successful Galileo registry dry-run measured:

- deployment gas: `299829`;
- first registration gas: `161123`;
- read-only Aristotle gas-price snapshot: `4000000007` wei;
- estimated deployment cost at that snapshot: `1199316002098803` wei;
- estimated registration cost at that snapshot: `644492001127861` wei;
- estimated combined cost at that snapshot: `1843808003226664` wei / `0.001843808003226664 0G`.

This is a point-in-time estimate, **not** an approved budget and not a mainnet spend. No Aristotle mainnet transaction was sent during M3.

## Measured 0G Sandbox envelope — M4

M4 used Galileo testnet tokens only; it did not incur or authorize a mainnet write.

Live execution provider `0xa19C4E672576E186AF81548E950Bf74A736220C3` reported HTTP terms that differed from the settlement contract. ProofRail therefore treats the **on-chain service terms as authoritative**:

- on-chain sandbox create fee: `60000000000000000` wei / `0.06 0G`;
- CPU price: `1000000000000000` wei / `0.001 0G` per CPU-minute;
- memory price: `500000000000000` wei / `0.0005 0G` per GB-minute;
- selected snapshot: 1 CPU, 1 GB memory, 3 GB disk;
- one-minute CPU+memory rate: `1500000000000000` wei / `0.0015 0G`.

The technical spike included one deliberately contained failed diagnostic run and one successful exact-commit build. Both sandboxes were deleted. Across the two attempts:

- first deposit: `0.08` Galileo testnet 0G;
- successful retry deposit: `69999999999999720` wei (`~0.07 0G`), topping the provider balance to the runner's capped target;
- total deposited to the provider during M4: `149999999999999720` wei (`~0.15 0G`);
- read-only post-success snapshot at `2026-08-17T16:23:56Z`: provider balance `20000000000000160` wei (`~0.02 0G`);
- cumulative provider settlement observed by that snapshot: `129999999999999560` wei (`~0.13 0G`) from the deposited testnet balance, excluding wallet gas.

The provider settles through vouchers asynchronously, so this is an **observed testnet balance accounting snapshot**, not a fiat cost, a quoted production price, or a guarantee of final settlement timing. HTTP fee fields must not override on-chain terms when they disagree.

## Cost discipline

- No Kubernetes.
- No dedicated database unless the working product requires persistent mutable state.
- No GPU rental.
- No paid monitoring suite.
- No paid AI API solely for demo optics.
- Sandbox execution services default back to read-only after a live spike; another paid/testnet-funded run requires an intentional config change.
