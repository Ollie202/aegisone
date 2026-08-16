# ProofRail *(working name)*

> A developer-security project for independently proving that a distributed software artifact corresponds to the source code it claims to come from.

**Status:** Project foundation / pre-implementation  
**Current target:** 0G Bridge Buildathon — Wave 3  
**Working-name warning:** `ProofRail` is not considered brand-safe yet. An unrelated active public project already uses the name in the trust/verification space. See `research/brand-risk.md`.

## The problem

Source code can be public and auditable while the binary, archive, package, or container that users actually install is produced elsewhere. A user should not have to blindly trust that the published artifact was built from the claimed source.

## The product thesis

The first ProofRail release will create independently inspectable evidence connecting:

`source commit -> build recipe -> build environment -> artifact digest -> stored provenance -> public registry record`

The long-term direction is an open verification network where multiple independent builders reproduce the same source and converge on the same artifact digest under explicit trust policies.

## Wave 3 definition of done

A successful Wave 3 build must demonstrate the real end-to-end path:

1. Select a public GitHub repository and exact commit.
2. Build it using the supported 0G confidential execution path.
3. Produce an artifact and calculate its SHA-256 digest.
4. Generate a canonical provenance manifest.
5. Upload the evidence to 0G Storage.
6. Anchor the verification record on 0G Chain mainnet.
7. Verify a genuine artifact successfully from the CLI/web interface.
8. Modify the artifact and show verification fail.

No mocked 0G integration counts as completion.

## Repository map

- `AGENTS.md` — operating instructions for coding agents.
- `PROJECT_STATE.md` — current project truth and immediate next actions.
- `docs/` — product, architecture, integrations, security, testing, and decisions.
- `planning/` — milestones, current sprint, risks, backlog, and budget control.
- `hackathon/` — 0G Bridge-specific requirements, judging, demo, and evidence.
- `research/` — competitors, prior art, research log, and brand risk.
- `apps/` — user-facing applications when implementation begins.
- `packages/` — reusable core, CLI, runners, and 0G adapters.
- `contracts/` — 0G Chain contracts.
- `examples/` — intentionally small repositories/artifacts used for verification demos.

## Important security boundary

ProofRail does **not** prove that software is safe or non-malicious. It proves evidence about **origin, build correspondence, and reproducibility**. Malicious source code can still produce a perfectly verified malicious artifact.

## Start here

Before implementing anything, read in this order:

1. `AGENTS.md`
2. `PROJECT_STATE.md`
3. `docs/00-vision.md`
4. `docs/01-prd.md`
5. `docs/03-architecture.md`
6. `docs/06-integrations.md`
7. `docs/07-security-threat-model.md`
8. `planning/current-sprint.md`

## License

Not selected yet. Do not add a license without an explicit decision recorded in `docs/decisions/`.
