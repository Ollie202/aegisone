# `@aegisone/discovery-ard`

Pinned Agentic Resource Discovery (ARD) adapter for AegisOne M8.2.

This package owns ARD request, response, media-type, catalog, and mapping details. `@aegisone/capability-model` remains ARD-agnostic. M8.2 searches only the deterministic in-memory catalog in this package; it performs no upstream network calls and has no wallet, signer, Supabase, LLM, or 0G capability.

## Upstream contract pin

Tests and implementation target `ards-project/ard-spec` commit `1d25abcf07e081f604dba3ae5398b16c79f20b7b`, identified upstream as ARD v0.9 Draft / Proposal dated 2026-05-28.

| Upstream file | Git blob at the pinned commit | Use |
| --- | --- | --- |
| `spec/ard.md` | `153a01c922ddb75f9d0d3b4abdfb74579abc97d9` | normative v0.9 behavior |
| `spec/schemas/ai-catalog.schema.json` | `37c4cb743b29741847e6f99f8bc8ccaaa2d6e422` | catalog manifest/value-or-reference shape |
| `spec/schemas/ard-entry.schema.json` | `f06cfec015c248e6994d0aa53ce8a03e27ad80e4` | ARD entry and search projection shape |
| `spec/schemas/ard.openapi.yaml` | `925af8cb8cbb86a9ecd72763bf70d33b4233004b` | `POST /search` request/response envelope |

The corresponding immutable raw-file URLs and blob IDs are exported from `src/constants.ts` and asserted by tests. Do not change the pin without reviewing the new upstream revision and updating implementation, fixtures, tests, and this provenance table together.

## M8.2 support profile

- catalog: `GET /.well-known/ai-catalog.json` through `proofrail-app`;
- search: `POST /search` through `proofrail-app`;
- resource media types: Agent Skill, MCP server card, A2A agent card, and generic OpenAPI document;
- supported search filter: `query.filter.type` only;
- federation: omitted or explicitly `none` only;
- query length: 1–2,000 Unicode code points;
- body maximum: 32 KiB;
- page size: default 10, maximum 25;
- deterministic lexical ranking only.

Search score is relevance metadata only. ARD `trustManifest` and arbitrary metadata are ignored when mapping an external entry into AegisOne. Namespaced `org.aegisone.*` metadata is emitted only from a `CapabilityResource` that passes the M8.1 validator, and it is not accepted back as proof.
