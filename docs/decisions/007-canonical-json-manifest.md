# ADR-007 — Canonical JSON subset for provenance commitments

**Status:** Accepted
**Date:** 2026-08-16

## Decision

Use a deliberately small canonical JSON representation for Wave 3 provenance commitments:

- recursively sort object keys by JavaScript string order;
- preserve array order;
- serialize the normalized value as compact UTF-8 JSON;
- normalize negative zero to zero;
- reject `undefined`, non-finite numbers, cycles, non-plain objects, functions, symbols, and bigint values;
- omit runtime timestamps and generated job identifiers from the canonical M1 manifest.

SHA-256 of those exact UTF-8 bytes is the manifest commitment.

## Why

M1 needs a dependency-free, byte-stable encoding before Storage or registry commitments are created. Failing on ambiguous values prevents silent field loss or environment-specific coercion. The supported manifest model only requires JSON strings, booleans, finite numbers, arrays, plain objects, and null.

## Consequences

- Logically identical supported records produce identical bytes and digests.
- Schema evolution must be explicit through `schemaVersion`.
- This is not claimed to implement RFC 8785/JCS. Interoperability that requires JCS must add a reviewed migration/version rather than silently change existing commitments.
