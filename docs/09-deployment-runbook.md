# Deployment Runbook

This document is intentionally incomplete until the first vertical slice exists.

## Environments

### Local
- core/CLI/tests;
- local runner;
- local Hardhat contract tests.

### 0G Galileo / test environment
- Storage spike;
- Sandbox/Tapp spike;
- contract deployment dry run if useful.

### 0G Aristotle mainnet
- final Wave 3 registry deployment;
- real registration transactions required for submission evidence.

## Secret handling

Expected secrets later:
- deployer/mainnet private key;
- testnet/sandbox wallet key if required;
- deployment platform secrets.

Rules:
- use local `.env`/platform secret stores;
- never commit secrets;
- do not expose chain signer private keys to frontend code.

## Pre-mainnet gate

Do not deploy to mainnet until:

- local contract tests pass;
- registry interface is frozen for Wave 3;
- a test deployment successfully registers/reads records;
- transaction cost is measured;
- deployer wallet contains only the minimum funds required.

## Post-deployment evidence

Immediately record in `hackathon/evidence.md`:
- network;
- chain ID;
- contract address;
- deployment transaction;
- verified source link if available;
- first real registration transaction;
- Storage root + upload transaction;
- live application URL.
