# ADR-009 — M4 0G Sandbox / Tapp evidence boundary

**Status:** Accepted  
**Date:** 2026-08-17

## Decision

Use the live hosted 0G Sandbox **non-sealed toolbox path** as the Wave 3 independent execution adapter, and represent Tapp/TDX provider evidence as a separate assurance dimension.

Do not label the current M4 path a TEE-attested build or claim that the artifact digest is bound into TDX attestation.

## Evidence

The successful M4 run on Galileo:

1. selected non-sealed provider `0xa19C4E672576E186AF81548E950Bf74A736220C3` and active snapshot `daytonaio/sandbox:0.5.0-slim`;
2. created a real sandbox through the provider API;
3. used Daytona toolbox `git/clone` with `commit_id=e9c82277cef2f7630977e2473664e14eed2f860d`;
4. downloaded `.git/HEAD` and verified that exact detached commit;
5. ran Node `v22.14.0` and the committed `examples/hello-proofrail/build.mjs`;
6. downloaded `/tmp/proofrail-m4/examples/hello-proofrail/dist/hello-proofrail.json`;
7. obtained exactly 53 bytes with SHA-256 `9978d500ee45216cb6c93b886857100ce95b63f6135dd339ace7ff533d9aa154`, matching the known publisher artifact;
8. deleted the sandbox in cleanup.

Separately, AegisOne queried the provider's registered Tapp node at `http://47.84.230.89:50051` and received real TDX quote evidence. The live quote is v5. Its 64-byte `report_data` is the provider signer address followed by zero padding:

`0xa19c4e672576e186af81548e950bf74a736220c30000000000000000000000000000000000000000000000000000000000000000000000000000000000000000`

AegisOne supplied the reproduced artifact SHA-256 as the GetEvidence challenge. The quote did not match the current upstream SHA-512 runtime-data construction for that challenge and the evidence envelope did not expose `runtime_data`. The quote did match the legacy signer-only scheme.

The observed sealed-only provider surface rejects toolbox operations, so the public API did not offer a path that was both sealed/TEE-bound and capable of the required arbitrary clone/build/retrieve workflow.

## Capability classification

| Capability | M4 status | Basis |
|---|---|---|
| Programmatic real 0G Sandbox execution | **PROVEN** | successful hosted provider run |
| Exact immutable commit checkout | **PROVEN** | toolbox `commit_id` + downloaded detached `.git/HEAD` |
| Constrained Node.js build | **PROVEN** | build exit code 0 on Node v22.14.0 |
| Retrieve produced artifact bytes | **PROVEN** | 53 downloaded bytes |
| Reproduced artifact digest match | **PROVEN** | exact SHA-256 equality |
| Provider TDX evidence exists | **PROVEN** | real TDX quote from registered Tapp node |
| Artifact digest bound to live TDX quote | **NOT AVAILABLE** | quote uses legacy signer-only `report_data` |
| Artifact proven computed inside TEE | **NOT AVAILABLE** | successful toolbox build is non-sealed; sealed toolbox is unavailable |

## Consequences

- Product copy may say **independent 0G rebuild**.
- Product copy may expose **provider TDX evidence** as a separate evidence dimension.
- Product copy must not say **TEE-attested build**, **TEE-computed artifact**, or **artifact-output binding** for this path.
- Policy code must treat missing output binding as unavailable, not silently upgrade it to PASS.
- A future Tapp/provider upgrade can add a stronger capability without changing `packages/core`; the runner should report capability/evidence explicitly.
- On-chain provider service terms are authoritative when they conflict with HTTP fee fields.

## Alternatives rejected

### Pretend the TDX provider quote attests the build
Rejected. That conflates provider identity/runtime evidence with artifact computation and is not supported by the quote bytes.

### Use the sealed-only provider for the build
Rejected for M4. The observed sealed-only public surface rejects toolbox operations required for clone/build/retrieve.

### Drop 0G Sandbox and use only the local runner
Rejected. M4 successfully proved the real hosted 0G execution path; the limitation is specifically TEE/output binding, not the independent execution capability.
