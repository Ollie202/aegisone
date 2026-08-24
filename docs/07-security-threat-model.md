# Security Threat Model

## Core security claim

ProofRail verifies evidence about **declared/authenticated source identity, artifact correspondence, and reproducibility**. It does not certify code safety.

## Existing threats

| ID | Threat | Impact | Mitigation / boundary | Residual risk |
|---|---|---|---|---|
| T-001 | Published artifact is modified/substituted | High | Independently hash publisher artifact and compare with reproduced output | Hash/canonicalization bugs |
| T-002 | Attacker declares a fake repository as the "official" source | High | Never auto-label official; represent source-claim assurance explicitly; M8 adds real repository-authority authentication | DECLARED claims can still be socially misleading |
| T-003 | Publisher's GitHub/account/source is compromised | High | Exact immutable commit + independent build evidence; stronger signed provenance where available | Authentication cannot prove benign intent/account integrity |
| T-004 | Builder lies about source/output | High | Exact immutable commit verification, retrieved artifact bytes, digest comparison; later multi-builder corroboration | M4 provider TDX evidence does not bind build output |
| T-005 | ProofRail rewrites provenance | High | Canonical evidence + 0G Storage + registry commitment | UI/application can still misrepresent if integrity checks are bypassed |
| T-006 | Git branch/tag moves | Medium | Resolve to immutable commit SHA | Compromised history/account remains possible |
| T-007 | Dependency substitution or nondeterminism | High | Lockfile/pinned environment; constrained supported stack | Some projects legitimately diverge |
| T-008 | Legitimate builds produce different bytes | Medium | Return DIVERGED/INSUFFICIENT evidence rather than MALICIOUS | Root cause may be hard to diagnose |
| T-009 | Giant/malicious repo exhausts compute/disk/time | High | Supported build family + hard job limits | Sandbox/runtime vulnerabilities |
| T-010 | Malicious build recipe attempts network/secret abuse | Critical | Sandbox isolation, no source secrets, constrained recipes/resource policy | Platform vulnerabilities remain |
| T-011 | Private key/API credential exposure | Critical | Server/worker signer only, environment secrets, no secret logging | Host compromise |
| T-012 | Frontend falsely displays green state | High | Raw evidence/JSON independently verifiable; frontend consumes stable evidence dimensions | Users may trust screenshots |
| T-013 | TEE attestation is overclaimed | High | Separate provider TDX evidence from build/output claims; fail closed on missing binding | Current provider uses legacy signer-only binding |
| T-014 | Multiple "independent" builders share same vulnerable stack | High later | Require real operational diversity before consensus claims | Correlated failure/collusion |
| T-015 | Agent executes artifact despite insufficient evidence | High | Machine-readable policy with explicit missing-evidence behavior; no auto-install in M8 | Consumer policy misconfiguration |
| T-016 | Provider HTTP pricing/config diverges from settlement contract | Medium | Treat chain/settlement/on-chain service terms as authoritative; funded-run caps | Provider/voucher behavior can still differ |

## M4 / TEE boundary

The successful M4 build used the non-sealed public toolbox API. Real TDX evidence was obtained separately from the provider's registered Tapp node. The live quote v5 `report_data` equals the provider signer padded to 64 bytes and does not bind ProofRail's supplied artifact digest.

Consequences:

- independent exact-commit rebuild and retrieved artifact digest are valid evidence;
- provider TDX identity/runtime evidence is valid evidence;
- the two must not be cryptographically conflated;
- `TEE Attested Build` is false/unavailable for the current flow;
- any future TEE-build policy must fail closed unless output/commitment binding is independently proven.

## M8 extension — discovery/source-auth/agent interface

M8 adds new attack surfaces. The detailed controls and test matrix live in `docs/17-m8-security-boundaries.md` and are part of the M8.11 backend-freeze gate.

### T-017 — discovery metadata masquerades as proof

An upstream ARD/registry result may claim `verified`, include a `trustManifest`, repository URL, or high relevance score.

Mitigation:

- upstream data maps only to discovery/provider metadata;
- only ProofRail evidence validators can populate source assurance/correspondence/audit/canonical evidence;
- regression tests prove ARD/provider round-trip cannot upgrade `INDEXED` data.

### T-018 — discovery description/prompt manipulation

A malicious Skill/tool description may attempt to manipulate an LLM consumer.

Mitigation:

- server trust/policy path is deterministic and does not interpret descriptions with an LLM;
- search relevance is explicitly non-trust;
- MCP does not auto-install/execute results;
- external text is treated as untrusted data.

### T-019 — SSRF through resource/distribution URLs

Mitigation:

- fixed allowlisted origins for discovery adapters;
- avoid generic server-side URL fetching;
- distribution fetch, when required, is HTTPS-only and rejects private/loopback/link-local/reserved targets;
- redirect targets are revalidated;
- redirect, timeout, byte and response limits apply;
- no internal auth header forwarded across redirects.

### T-020 — archive/package bomb/path traversal

Mitigation:

- compressed/decompressed/per-file/file-count bounds;
- normalized relative paths only;
- reject traversal, duplicate normalized paths, device entries and unsafe links;
- bounded fresh temp directories and cleanup.

### T-021 — anonymous verification spend abuse

Mitigation:

- public search/read/policy are cheap/read-only;
- expensive verification is worker/admin controlled;
- no generic public `verify-anything` endpoint;
- hard concurrency/budget/deposit caps;
- search never triggers 0G work.

### T-022 — GitHub OAuth CSRF/replay/token exposure

Mitigation:

- random high-entropy `state`;
- short expiry + single use;
- Secure/HttpOnly/SameSite session handling;
- exact callback allowlist;
- codes/tokens/client secret never logged;
- no ordinary plaintext long-term OAuth-token persistence.

### T-023 — fake repository authority

Mitigation:

- default is `NONE`/`DECLARED`;
- `REPOSITORY_AUTHENTICATED` requires real GitHub App user authorization plus sufficient effective write/push/admin-equivalent authority;
- stable repository ID and exact commit recorded;
- read/triage/unknown authority cannot upgrade assurance.

### T-024 — repository rename/transfer identity confusion

Mitigation:

- record stable GitHub repository ID and owner/user IDs in evidence in addition to human-readable name;
- historical claims are not silently rewritten after rename/transfer;
- current authority re-check is separate from historical claim evidence.

### T-025 — attestation presence mistaken for cryptographic verification

Mitigation:

- listing candidate GitHub attestations is separate from verifying them;
- `SIGNED_RELEASE` only after cryptographic verifier succeeds under expected artifact/repository/source/signer constraints;
- unavailable verifier means unavailable assurance, not weaker semantics.

### T-026 — Supabase trust escalation

Mitigation:

- Supabase is mutable catalog state only;
- canonical source claims have deterministic digest;
- cached strong evidence remains integrity checked;
- canonical ProofRail evidence/0G commitments are the stronger historical path;
- DB-only inserted discovery/trust-looking rows must not create strong verdicts.

### T-027 — stale evidence silently treated as current

Mitigation:

- expose discovery `observedAt`, source `authenticatedAt`, verification `verifiedAt`;
- consumer policy may require maximum evidence age;
- invalid/missing timestamps fail according to explicit missing-evidence policy.

### T-028 — provider outage mutates trust

Mitigation:

- provider outage is availability state only;
- partial search results allowed;
- existing canonical evidence is not downgraded/deleted because a discovery provider is offline.

### T-029 — MCP becomes privileged execution backdoor

Mitigation:

Initial M8 MCP tools are limited to:

- `proofrail_search`
- `proofrail_inspect`
- `proofrail_evaluate`

No install/execute/sign/arbitrary-build/secret-upload tool.

## Security invariants

- A digest mismatch can never be displayed as a correspondence PASS.
- Source ownership/authentication and artifact correspondence are separate dimensions.
- Repository existence/discovery metadata does not authenticate the publisher's source claim.
- Missing evidence never upgrades assurance.
- New commits/releases create new records rather than mutating historical evidence.
- UI state must be derivable from raw/validated checks.
- Verifiers/readers do not require private signing keys.
- `proofrail-app` must not hold the 0G signer.
- TEE status derives from real evidence, not a backend boolean.
- Provider TDX evidence alone is not a TEE-attested build.
- Output binding is claimed only when evidence cryptographically binds the relevant output/commitment.
- LLM output cannot change cryptographic correspondence or deterministic policy.
- Search relevance cannot affect ProofRail trust policy.
- Public discovery/read routes cannot trigger uncontrolled funded verification.
- Resource limits/funded-run caps are part of the security boundary.
- `MATCH` never means safe.

## M8 backend security freeze

Issue #30 / M8.11 requires the detailed controls in `docs/17-m8-security-boundaries.md`, complete tests/CI/Gitleaks, Supabase advisor review after migrations, Railway secret-boundary verification, and stable API/MCP contracts before the M9 frontend begins.

## Later expansion

Before an open builder network, additionally model Sybil builders, collusion, correlated infrastructure, policy downgrade, reputation gaming, malicious job economics, private-source access, and builder diversity.
