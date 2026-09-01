# 0G integration

0G is infrastructure for AegisOne evidence, not decoration.

## Storage

AegisOne uses 0G Storage for durable evidence/package publication. The protected flow uploads canonical bytes, retrieves them with proof where supported, verifies exact-byte equality, then records the resulting root inside the evidence facts.

Latest real Verified Library publication (`hackathon/m10-0g-publication-evidence.json`):

- network: 0G Galileo Testnet, chain `16602`;
- storage root: `0x0e1d07db2978c791e24a5eb1ffa566ffb1f797fe280bc4bb40146ad9108d59e1`;
- transaction: `0x005c8b1ae4640f3f1d9db3eff64ab96d63f5b83cd7bceddc6b39047190578437`;
- canonical evidence SHA-256: `fcff2567d995c13e715807d781f61788808f73adbfc7f27c5ecf7878c28403af`;
- exact-byte proof/readback: true.

## Chain / registry

The registry is for compact commitments, not large reports.

Historical M5/M7 receipts prove earlier registry paths. The latest Verified Library publication deliberately has **no new registry commitment** because that resource has `NOT_EVALUATED` correspondence and therefore lacked the complete real commitment set the registry flow requires.

Do not display a chain commitment where none exists.

## Compute

0G Compute is an optional advisory analysis layer. It can explain or highlight suspicious behavior, but its output:

- cannot set `MATCH` / `MISMATCH`;
- cannot override deterministic audit findings/verdicts;
- must be labelled advisory/unavailable when appropriate.

## Sandbox / independent execution

The proven verification foundation uses 0G Sandbox for independent reproduction/execution work. Correspondence is still based on exact deterministic artifact/package bytes, not on an LLM opinion.

TEE/TDX provider evidence must be described precisely. Existing live legacy evidence does not justify claiming that the final artifact digest was cryptographically bound into a TEE quote.

## Spend boundary

The signer stays on `aegisone-worker`. Public browsing/search/policy calls must never spend 0G implicitly. Publishing is an explicit protected operation.

No new funded 0G run or mainnet write without explicit approval.
