# Roadmap

## v0.1 — Wave 3: Verifiable Release Foundation

Goal: prove a real source-to-artifact verification path with meaningful 0G dependencies.

Capabilities:
- exact source commit;
- deterministic build recipe;
- local + 0G runner path;
- artifact hashing;
- canonical provenance;
- 0G Storage evidence;
- 0G mainnet registry;
- CLI/web verification;
- tampered-artifact failure demo.

## v0.2 — Wave 4: Independent Reproduction

Goal: remove more trust from a single builder.

Candidate capabilities:
- second independent builder adapter;
- N-of-M trust policy;
- reproducibility comparison;
- stronger TEE/output binding if not fully achieved in v0.1;
- GitHub Action;
- external repositories using the system.

## v0.3 — Wave 5: Open Verification Network

Goal: turn point verification into a network primitive.

Candidate capabilities:
- multiple independent builders;
- builder enrollment and explicit capabilities;
- consensus/reproduction records;
- policy-driven verification (`2-of-3`, `require-TEE`, etc.);
- public project verification history;
- initial builder/job economics only if security design is mature.

## Post-Buildathon

- package/container support beyond the first stack;
- registry/package-manager integrations;
- enterprise verification policies;
- CI/CD integrations;
- sustainable builder economics;
- provider-neutral attestation adapters;
- broader security/reproducible-build ecosystem interoperability.
