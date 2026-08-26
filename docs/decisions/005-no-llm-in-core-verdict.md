# ADR-005 — No LLM in the core correspondence verdict

**Status:** Accepted  
**Date:** 2026-08-16

## Decision

`MATCH`, `MISMATCH`, reproducibility/divergence, digest validation, and policy evaluation are deterministic operations. An LLM may not alter these results.

LLMs/0G Compute may later explain divergence by analyzing logs, dependencies, timestamps, toolchains, or environments.

## Why

AegisOne's core value is independently checkable evidence. Introducing probabilistic model judgment into the correspondence verdict weakens that property and incorrectly turns the product into a malware/code-quality auditor.
