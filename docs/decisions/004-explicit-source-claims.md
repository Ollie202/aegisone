# ADR-004 — Source identity must be explicit

**Status:** Accepted  
**Date:** 2026-08-16

## Decision

AegisOne will never infer or label an arbitrary repository as the official source without explicit identity evidence.

Every release begins from a `ReleaseClaim` connecting publisher/declarant, repository, immutable commit, build recipe, and artifact. Source assurance is represented separately from artifact-reproduction assurance.

Wave 3 may use `DECLARED` source claims. Later versions can add GitHub repository authentication, signed manifests, domain/package identity, and onchain identity.

## Why

"Which repository is official?" and "does this artifact reproduce from that repository?" are separate security problems. Conflating them creates false confidence.
