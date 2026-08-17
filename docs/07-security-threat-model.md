# Security Threat Model

## Core security claim

ProofRail verifies evidence about **declared source identity, artifact correspondence, and reproducibility**. It does not certify code safety.

## Threats

| ID | Threat | Impact | Wave 3 mitigation | Residual risk |
|---|---|---|---|---|
| T-001 | Published artifact is modified/substituted | High | Independently hash publisher artifact and compare with reproduced output | Hash/canonicalization bugs |
| T-002 | Attacker declares a fake repository as the "official" source | High | Never auto-label official; represent source-claim assurance explicitly | DECLARED claims can still be socially misleading |
| T-003 | Publisher's GitHub/account/source is compromised | High | Exact immutable commit + independent build evidence | Independent reproduction cannot prove malicious source is benign |
| T-004 | Builder lies about source/output | High | Exact immutable commit verification, retrieved artifact bytes, digest comparison; later multi-builder corroboration | M4 provider TDX evidence does not bind the build output |
| T-005 | ProofRail rewrites provenance | High | 0G Storage evidence + registry commitment | UI can still misrepresent evidence |
| T-006 | Git branch/tag moves | Medium | Resolve to immutable commit SHA | Compromised history/account remains possible |
| T-007 | Dependency substitution or nondeterminism | High | Lockfile/pinned environment; constrained supported stack | Some projects legitimately diverge |
| T-008 | Legitimate builds produce different bytes | Medium | Return DIVERGED/NOT_REPRODUCIBLE, never MALICIOUS | Root cause may be hard to diagnose |
| T-009 | Giant/malicious repo exhausts compute/disk/time | High | Public-only supported build family + hard job limits | Sandbox/runtime vulnerabilities |
| T-010 | Malicious build recipe attempts network/secret abuse | Critical | Sandbox isolation, no source secrets, constrained supported recipes and resource policy | Non-sealed public toolbox and sandbox/platform vulnerabilities remain |
| T-011 | Private key/API credential exposure | Critical | Server/CLI signer only, environment secrets, Railway references, no secret logging | Host compromise |
| T-012 | Frontend falsely displays green state | High | CLI/raw evidence/JSON independently verifiable | Users may trust screenshots |
| T-013 | TEE attestation is overclaimed | High | Separate provider TDX evidence from build/output claims; parse quote/report_data and fail closed on missing binding | TEE/platform supply-chain assumptions; live provider currently uses legacy signer-only binding |
| T-014 | Multiple "independent" builders share the same vulnerable stack | High later | Require real operational diversity before consensus claims | Correlated failure/collusion |
| T-015 | Agent executes artifact despite insufficient evidence | High later | Machine-readable policy result with fail-closed semantics | Agent policy misconfiguration |
| T-016 | Provider HTTP pricing/config diverges from settlement contract | Medium | Treat chain ID, settlement contract, and on-chain service terms as authoritative before funded runs; hard deposit cap | Provider behavior/voucher timing can still differ from estimates |

## M4-specific boundary

The successful M4 build used the non-sealed public toolbox API. Real TDX evidence was obtained separately from the provider's registered Tapp node. The live quote v5 `report_data` equals the provider signer padded to 64 bytes and does not bind ProofRail's supplied artifact digest.

Consequences:

- independent exact-commit rebuild and retrieved artifact digest are valid evidence;
- provider TDX identity/runtime evidence is valid evidence;
- the two must not be cryptographically conflated;
- `TEE Attested Build` is false/unavailable for the current flow;
- any future TEE-build policy must fail closed unless output/commitment binding is independently proven.

## Security invariants

- A digest mismatch can never be displayed as a correspondence PASS.
- Source ownership and artifact correspondence are separate dimensions.
- Missing evidence never upgrades assurance.
- New commits/releases create new records rather than mutating historical evidence.
- UI state must be derivable from raw checks.
- Verifiers do not require private signing keys.
- TEE status must derive from real evidence, not a backend boolean.
- Provider TDX evidence alone is not a TEE-attested build.
- Output binding is claimed only when the quote/evidence cryptographically binds the relevant output or commitment.
- LLM output cannot change a cryptographic MATCH/MISMATCH result.
- Resource limits and funded-run caps are part of the security boundary, not merely cost optimization.

## Later expansion

Before an open builder network, model Sybil builders, collusion, correlated infrastructure, policy downgrade, reputation gaming, malicious job economics, private-source access, and builder diversity.
