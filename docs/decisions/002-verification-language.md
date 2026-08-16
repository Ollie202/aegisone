# ADR-002: Explicit verification levels and non-claims

**Status:** Accepted  
**Date:** 2026-08-16

## Decision

Do not expose one generic `VERIFIED` state for every type of evidence. Use explicit levels such as Integrity Verified, Source Attested, TEE Attested, Reproduced, and Consensus Verified.

## Reason

The evidence required for each claim is materially different. A matching hash does not prove a TEE build, and a TEE build does not prove software safety.

## Consequence

UI, CLI, manifest schema, tests, and submission copy must preserve these distinctions.
