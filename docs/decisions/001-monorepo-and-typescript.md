# ADR-001: Monorepo and TypeScript-first Wave 3 stack

**Status:** Accepted  
**Date:** 2026-08-16

## Decision

Use a pnpm monorepo with TypeScript for core logic, CLI, adapters, and web application. Use Solidity with Hardhat for the initial registry contract.

## Why

- Keeps most Wave 3 work in one language/tooling ecosystem.
- The official 0G Storage SDK provides a TypeScript path and uses ethers.
- Allows reusable provider adapters without coupling core logic to the web app.
- Minimizes toolchain overhead for a solo developer under a short deadline.

## Consequences

- Node.js 22 is the initial runtime target.
- 0G-specific code must remain outside `packages/core`.
- A later migration to Foundry for deeper contract testing is possible but not required for the first vertical slice.
