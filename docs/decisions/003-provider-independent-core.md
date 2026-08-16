# ADR-003: Provider-independent verification core

**Status:** Accepted  
**Date:** 2026-08-16

## Decision

Core artifact hashing, provenance schemas, canonicalization, verification rules, and trust-policy logic must not depend directly on 0G SDKs.

0G is implemented through explicit runner/storage/registry adapters.

## Why

- Preserves the product after the 0G Buildathon.
- Makes future hackathon/provider integrations additive rather than rewrites.
- Makes core verification testable offline.
- Clarifies exactly what trust 0G removes from the system.

## Consequence

Removing 0G adapters should leave a functioning local verification library, but the Wave 3 decentralized/confidential evidence properties would disappear.
