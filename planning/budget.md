# Budget

## Known developer-tool budget

- Two ChatGPT accounts at the user's existing paid level.

## External infrastructure policy

**Default allowed spend: $0 until explicitly approved.**

Free/test resources should be used for development where possible. Mainnet transactions and 0G Sandbox usage may require small real costs; measure them before committing.

| Item | Development approach | Spend rule |
|---|---|---|
| Local compute | Existing development environment | $0 incremental |
| GitHub | Existing account | Free/public repo |
| Web hosting | Free tier where adequate | Do not upgrade without need |
| 0G Storage | Test environment first | Measure before mainnet/paid usage |
| 0G Chain | Local/testnet first | Mainnet only after contract gate |
| 0G Sandbox | Short technical spikes only | Stop immediately after test; record cost |
| AI APIs | None required for core | Do not add in Wave 3 unless justified |

## Measured 0G Chain envelope — M3

The successful Galileo registry dry-run measured:

- deployment gas: `299829`;
- first registration gas: `161123`;
- read-only Aristotle gas-price snapshot: `4000000007` wei;
- estimated deployment cost at that snapshot: `1199316002098803` wei;
- estimated registration cost at that snapshot: `644492001127861` wei;
- estimated combined cost at that snapshot: `1843808003226664` wei / `0.001843808003226664 0G`.

This is a point-in-time estimate, **not** an approved budget and not a mainnet spend. No Aristotle mainnet transaction was sent during M3. Re-query fee data immediately before any future mainnet gate and obtain explicit approval before spending.

## Cost discipline

- No Kubernetes.
- No dedicated database unless the working product requires persistent mutable state.
- No GPU rental.
- No paid monitoring suite.
- No paid AI API solely for demo optics.
