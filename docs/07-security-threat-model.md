# Security Threat Model

## Core security claim

ProofRail verifies evidence about **artifact origin/correspondence/reproducibility**. It does not certify software safety.

## Threats

| ID | Threat | Impact | Likelihood | Wave 3 mitigation | Residual risk |
|---|---|---|---|---|---|
| T-001 | Published artifact modified after verification | High | High | Local SHA-256 recalculation and digest comparison | Hash algorithm/manifest bugs |
| T-002 | Builder lies about source used | High | Medium | Exact source commit in provenance; 0G execution evidence where proven | Weak output binding if attestation cannot bind artifact digest |
| T-003 | ProofRail server rewrites provenance | High | Medium | Evidence root on 0G Storage + compact mainnet commitment | UI could still misrepresent data |
| T-004 | Fake/malformed provenance | High | Medium | Schema validation + canonical serialization + registry checks | Parser/canonicalization defects |
| T-005 | Git branch/tag moves | Medium | High | Resolve to immutable commit SHA | Compromised repository history/account still possible |
| T-006 | Malicious source code | High | Medium | Explicit non-claim; provenance proves origin only | Software may be intentionally malicious |
| T-007 | Dependency substitution/non-determinism | High | High | Require lockfile/pinned environment for supported Wave 3 builds | Ecosystem/network nondeterminism remains |
| T-008 | Private key exposure | Critical | Medium | Server/CLI signer only, secret env vars, no browser/private-key logging | Host compromise |
| T-009 | Compromised frontend shows false green state | High | Medium | CLI/raw evidence can independently verify; show evidence links | Users may still trust screenshots/UI |
| T-010 | Registry spam/duplicate claims | Medium | Medium | Contract design + explicit submitter identity/events | Permissionless false claims still possible unless policy scoped |
| T-011 | TEE attestation overclaim | High | Medium | Capability flags; only surface evidence actually verified | TEE supply-chain/platform assumptions remain |
| T-012 | Reproducible build fails for legitimate reasons | Medium | High | Start with narrow supported runtime; report divergence, not maliciousness | Many projects are not reproducible by default |

## Security invariants

- A mismatch can never be displayed as verified.
- Missing evidence never upgrades a verification level.
- UI status must be derivable from underlying checks.
- The verifier must not require a private signing key.
- Source references used in proofs must resolve to immutable commits.
- TEE status must be independently verifiable from actual evidence, not a boolean supplied by our backend.

## Later threat-model expansion

Wave 4/5 must add builder collusion, Sybil builders, reward manipulation, policy downgrade attacks, cross-builder environment equivalence, and consensus/reputation economics before introducing an open builder network.
