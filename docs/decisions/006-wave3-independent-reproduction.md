# ADR-006 — Independent reproduction is the Wave 3 product wedge

**Status:** Accepted  
**Date:** 2026-08-16

## Decision

Wave 3 must compare a publisher/distributed artifact with an artifact independently rebuilt from the exact declared source revision.

A design that merely accepts a publisher-provided artifact hash and anchors it onchain is insufficient.

## Why

Publisher-side provenance already has strong existing solutions such as GitHub Artifact Attestations, Sigstore, and SLSA-compatible workflows. Independent reproduction creates a clearer additional trust boundary and a stronger 0G use case.

## Consequence

M1 and M5 acceptance criteria are updated around publisher-vs-rebuild comparison, and the 90-second demo centers on MATCH followed by substituted-artifact MISMATCH.
