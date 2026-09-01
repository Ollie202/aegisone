# Architecture

AegisOne should be understandable from one diagram:

```text
                    humans / agents
                          |
                          v
                 Vercel — apps/web
                 /       |        \
                /        |         \
        discovery     Supabase      Railway worker
        providers     mutable state   aegisone-worker
                                      |
                                      v
                                  0G services

Verification path:
recorded exact source + distributed artifact
        -> bounded acquisition/reproduction
        -> deterministic audit + digest comparison
        -> evidence
        -> optional protected 0G publication
```

## Deployable apps

### `apps/web`

Primary public product and API surface. It serves:

- Skills, Audit, Verified and For Agents pages;
- REST discovery/audit/verification/evidence/policy routes;
- MCP transport;
- catalog reads and controlled job triggers.

Vercel is the primary host. Railway `aegisone-app` is parity/fallback for the same product surface.

### `apps/worker`

Privileged Railway worker. It is the only deployable component allowed to hold the 0G storage signer. Public/browser code must never construct a signer or gain a generic signing/execution endpoint.

## Data and external systems

### Supabase

Mutable application state: catalog rows, discoveries, source claims, verification rows and job state. It is useful indexing/cache state, not a proof authority.

### Discovery providers

ARD-compatible/local discovery plus GitHub Agent Finder, Hugging Face Discover and the official MCP Registry. Their metadata can create discovery records only; it cannot create AegisOne trust evidence.

### 0G

- **Storage:** durable evidence/package bytes with proof-verified readback where the live flow supports it.
- **Chain/registry:** compact commitments only when the required real commitments exist.
- **Compute:** optional advisory analysis; never deterministic verdict authority.
- **Sandbox:** independent execution/reproduction integration used by the proven verification work.

See `ZEROG.md`.

## Current package layout

The repository still contains more packages than the desired long-term shape. Treat them as five logical domains while simplifying:

| Logical domain | Current modules |
| --- | --- |
| **core** | `core`, `capability-model` |
| **audit** | `skill-audit`, `skill-verification-link`, `runner-local` |
| **discovery** | `discovery-ard`, `discovery-providers` |
| **data** | `catalog-store`, `job-store` |
| **zerog** | `storage-0g`, `compute-0g`, `sandbox-0g`, `registry-0g`, `evidence-publish` |

`source-auth-github`, CLI/contracts and historical milestone runners remain separate for now because deleting/merging them requires behavior-aware cleanup.

## Simplification target

Move toward:

```text
apps/
  web/
  worker/
packages/
  core/
  audit/
  discovery/
  data/
  zerog/
contracts/
supabase/
examples/
hackathon/
docs/
```

Do not perform a giant rename just to make the tree pretty. Consolidate one logical domain at a time, keep public API/MCP/evidence behavior stable, and let tests prove parity.

Historical `m5-flow` / `m7-flow` code should eventually leave the active workspace after its useful live evidence is preserved. `hackathon/*.json` evidence remains unchanged.

## Dependency rules

1. Core evidence/policy semantics do not depend on GitHub, ARD, Supabase, MCP or 0G provider details.
2. Provider adapters translate into core models; provider metadata cannot upgrade trust.
3. Public web code does not gain worker secrets.
4. Expensive/funded work is explicit and bounded.
5. Avoid new packages. Prefer a module inside an existing logical domain unless a hard boundary demands otherwise.
6. Avoid god files: route -> small handler -> domain service is the preferred shape.
