# Risk Register

| ID | Risk | Probability | Impact | Mitigation / next action | Status |
|---|---|---:|---:|---|---|
| R-001 | 0G Sandbox does not expose a practical programmatic build/retrieval path | Medium | High | Test before UI work; keep runner interface adaptable | Open |
| R-002 | Artifact digest cannot be directly bound into accessible TEE attestation | Medium-High | High | Measure exact evidence; make stronger binding Wave 4 if needed; never overclaim | Open |
| R-003 | Node/npm build is nondeterministic | High | Medium | Require lockfile and narrow fixture/runtime; define reproducibility constraints | Open |
| R-004 | Mainnet deployment/tx funding causes deadline friction | Medium | High | Finish contract/testnet path early; fund only minimum wallet later | Open |
| R-005 | 0G SDK changes during build | Medium | Medium | Pin working versions after spike; record versions in integration docs | Open |
| R-006 | Scope explosion | High | High | Enforce PRD non-goals and sprint scope through `AGENTS.md` | Active control |
| R-007 | Security marketing exceeds actual guarantees | Medium | Critical | Verification levels + threat model + non-claim ADR | Active control |
| R-008 | Product has zero adoption signal | Medium | Medium | After M5, recruit a few real public repos rather than chasing mass users | Later |
| R-009 | `AegisOne` brand conflicts with existing active project | High | Medium-High | Treat as working name; rename before launch/submission if necessary | Open |
| R-010 | AI coding budget is consumed on broad rewrites | Medium | High | Small tasks, written acceptance criteria, agents read state/docs first | Active control |
