# Security Threat Model

## Core security claim

ProofRail verifies evidence about **declared source identity, artifact correspondence, and reproducibility**. It does not certify code safety.

## Threats

| ID | Threat | Impact | Wave 3 mitigation | Residual risk |
|---|---|---|---|---|
| T-001 | Published artifact is modified/substituted | High | Independently hash publisher artifact and compare with reproduced output | Hash/canonicalization bugs |
| T-002 | Attacker declares a fake repository as the "official" source | High | Never auto-label official; represent source-claim assurance explicitly | DECLARED claims can still be socially misleading |
| T-003 | Publisher's GitHub/account/source is compromised | High | Exact immutable commit + independent build evidence | Independent reproduction cannot prove malicious source is benign |
| T-004 | Builder lies about source/output | High | 0G execution evidence where proven; later independent multi-builder corroboration | Weak output binding if artifact digest is not attestation-bound |
| T-005 | ProofRail rewrites provenance | High | 0G Storage evidence + mainnet commitment | UI can still misrepresent evidence |
| T-006 | Git branch/tag moves | Medium | Resolve to immutable commit SHA | Compromised history/account remains possible |
| T-007 | Dependency substitution or nondeterminism | High | Lockfile/pinned environment; constrained supported stack | Some projects legitimately diverge |
| T-008 | Legitimate builds produce different bytes | Medium | Return DIVERGED/NOT_REPRODUCIBLE, never MALICIOUS | Root cause may be hard to diagnose |
| T-009 | Giant/malicious repo exhausts compute/disk/time | High | Public-only allowlisted build family + hard job limits | Sandbox/runtime vulnerabilities |
| T-010 | Malicious build recipe attempts network/secret abuse | Critical | Sandbox isolation, no secrets by default, network/resource policy | Sandbox escape/platform bugs |
| T-011 | Private key/API credential exposure | Critical | Server/CLI signer only, secret env vars, no logging | Host compromise |
| T-012 | Frontend falsely displays green state | High | CLI/raw evidence/JSON independently verifiable | Users may trust screenshots |
| T-013 | TEE attestation is overclaimed | High | Capability flags and raw evidence; output binding only when proven | TEE/platform supply-chain assumptions |
| T-014 | Multiple "independent" builders share the same vulnerable stack | High later | Require real operational diversity before consensus claims | Correlated failure/collusion |
| T-015 | Agent executes artifact despite insufficient evidence | High later | Machine-readable policy result with fail-closed semantics | Agent policy misconfiguration |

## Security invariants

- A digest mismatch can never be displayed as a correspondence PASS.
- Source ownership and artifact correspondence are separate dimensions.
- Missing evidence never upgrades assurance.
- New commits/releases create new records rather than mutating historical evidence.
- UI state must be derivable from raw checks.
- Verifiers do not require private signing keys.
- TEE status must derive from real evidence, not a backend boolean.
- LLM output cannot change a cryptographic MATCH/MISMATCH result.
- Resource limits are part of the security boundary, not merely cost optimization.

## Later expansion

Before an open builder network, model Sybil builders, collusion, correlated infrastructure, policy downgrade, reputation gaming, malicious job economics, private-source access, and builder diversity.
