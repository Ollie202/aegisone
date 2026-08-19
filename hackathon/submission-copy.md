# AKINDO Submission Copy — ProofRail

Use this as a **paste-ready packet**, not as a claim that these are AKINDO's exact current field labels. The authenticated AKINDO form is dynamic; re-open it immediately before submission and map the relevant sections below into the fields shown there.

**Current 0G Bridge Buildathon page:** https://app.akindo.io/wave-hacks/Z4MlX4vreI72ol6pd

## Project name

ProofRail

## One-line pitch

ProofRail independently reproduces software and Agent Skills from an exact publisher-declared source commit, compares the distributed bytes, and preserves verifiable evidence on 0G.

## Short description

A public GitHub repository does not prove that the artifact users receive was actually built from that source. ProofRail independently reproduces the exact declared commit in 0G Sandbox, reports deterministic `MATCH` / `MISMATCH` correspondence, stores canonical evidence on 0G Storage, and anchors compact commitments on 0G Chain. Agent Skills additionally receive a separate deterministic security audit so `MATCH` never means “safe.”

## Problem

Software supply chains can fail even while the public source repository still looks clean. A compromised release server, CI path, maintainer account, marketplace, or distribution layer can serve bytes that do not correspond to the source users think they are trusting.

Existing provenance metadata is useful, but ProofRail targets a narrower question: **do the bytes being distributed actually correspond to an independently reproduced artifact from the exact source claim?**

## Solution

ProofRail takes an explicit publisher source claim, pins an immutable commit, independently reproduces the artifact, compares SHA-256 digests, and emits canonical evidence. A genuine artifact returns `MATCH`; a substituted artifact returns `MISMATCH` while the independently reproduced bytes remain unchanged.

For Agent Skills, ProofRail keeps two answers independent:

1. **Correspondence** — do the distributed skill-package bytes match the independently packaged exact source commit?
2. **Security audit** — what risky instructions, scripts, resources, exfiltration paths, destructive operations, encoded execution, persistence, or undeclared executable resources exist?

A matching skill can therefore still have critical findings. ProofRail never turns `MATCH` into a safety claim.

## Current progress

ProofRail is no longer a local prototype. The current public build has progressed through:

- deterministic local independent reproduction and `MATCH` / `MISMATCH` kernel;
- real proof-verified 0G Storage round trips with exact-byte retrieval;
- a minimal evidence registry with exact contract readback;
- real 0G Sandbox execution and artifact retrieval;
- an end-to-end software verification slice anchored on 0G Aristotle mainnet;
- a live product runtime with a proof-first web surface and controlled worker boundary;
- first-class Agent Skill deterministic packaging, correspondence, and static security auditing;
- a live Agent Skill reproduction on Galileo with proof-verified 0G Storage and exact registry readback;
- full-history Gitleaks scanning in CI and a public judge-facing deployment.

## Why 0G is load-bearing

ProofRail uses 0G for three different trust-reduction roles:

### 0G Sandbox

Runs the independent reproduction path so the result is not merely produced by ProofRail's ordinary application server.

### 0G Storage

Stores canonical verification evidence and proves the retrieved bytes are exactly the bytes that were uploaded.

### 0G Chain

Anchors compact historical commitments so ProofRail cannot silently rewrite past verification records. The software vertical slice is already registered on Aristotle mainnet.

## Real observed results

### Software correspondence

Publisher artifact SHA-256:

`9978d500ee45216cb6c93b886857100ce95b63f6135dd339ace7ff533d9aa154`

Independent 0G reproduction SHA-256:

`9978d500ee45216cb6c93b886857100ce95b63f6135dd339ace7ff533d9aa154`

Result: **MATCH**

Controlled substituted publisher SHA-256:

`d5318963f53126b4c4bd448bffca222a8e08f068764e379516fc0ad3bd1f8889`

The reproduced digest stayed unchanged, so the result became **MISMATCH**.

### Agent Skill correspondence

Publisher package SHA-256:

`fb33d14404f6b4b88666af027b9a22484d0df468e3c8343a1169358c2b78e878`

Independent 0G package SHA-256:

`fb33d14404f6b4b88666af027b9a22484d0df468e3c8343a1169358c2b78e878`

Result: **MATCH**

Controlled substituted package SHA-256:

`da2f61f4da0662b6f05964834a95b7cfe0dbccb5eb69a3794e0e332ee12e54eb`

Result: **MISMATCH**

The clean fixture's deterministic audit produced `0` findings; separate malicious fixtures prove combinations such as `MATCH + CRITICAL FINDINGS`. LLM advisory analysis is `NOT_RUN` in deterministic evidence.

## Links to paste into the submission

- Live app: https://proofrail-app-production.up.railway.app
- Public repository: https://github.com/Ollie202/proofrail-0g
- Current Bridge Buildathon page: https://app.akindo.io/wave-hacks/Z4MlX4vreI72ol6pd
- Evidence ledger: https://github.com/Ollie202/proofrail-0g/blob/main/hackathon/evidence.md
- M5 Aristotle mainnet evidence: https://github.com/Ollie202/proofrail-0g/blob/main/hackathon/m5-aristotle-mainnet.json
- M7 Agent Skill evidence: https://github.com/Ollie202/proofrail-0g/blob/main/hackathon/m7-live-evidence.json
- Demo script: https://github.com/Ollie202/proofrail-0g/blob/main/hackathon/demo-plan.md
- M5 Aristotle registry: `0xeD2361a6B56dc0d4a7494F3a46BA47f352050BA4`
- M5 mainnet registration tx: `0xeffe42c509522cbdb4c434022d5e2fbf58eaf42981ae491570af6373391826ac`
- M7 Galileo registration tx: `0xd274b52a05ca026b85836cefd28277fe7b87f3e0924f806d45f866671bb158db`
- Demo video: **ADD FINAL RECORDED VIDEO URL BEFORE SUBMISSION**

## Suggested progress/update paragraph

This wave I moved ProofRail from a local verification idea into a live, judge-inspectable 0G product. The system now independently reproduces exact source commits through 0G Sandbox, detects genuine versus substituted release bytes, stores proof-verified canonical evidence on 0G Storage, and anchors compact commitments on 0G Chain. I also extended the same trust model to Agent Skills: deterministic package correspondence stays separate from deterministic security findings, so a matching skill is never automatically labelled safe. The software slice is anchored on Aristotle mainnet, the Agent Skill slice has exact Galileo registry readback, the proof-first web app is live, and the full public repository is covered by CI plus a full-history secret scan.

## Suggested technical differentiation paragraph

ProofRail is not a generic “blockchain provenance” dashboard. The core differentiator is **independent reproduction + exact byte correspondence + portable evidence**. Mutable application state cannot invent a `MATCH` or `MISMATCH`; those results come from the verification evidence. For Agent Skills, security findings are also kept separate from provenance so the product can represent states such as `MATCH + CRITICAL FINDINGS` without collapsing everything into a vague trust score.

## Suggested 0G integration paragraph

0G is load-bearing rather than decorative. 0G Sandbox provides the independent execution environment, 0G Storage preserves the full canonical evidence with proof verification and exact-byte retrieval, and 0G Chain stores compact immutable commitments. A real software verification is already registered on Aristotle mainnet, while the Agent Skill proof is registered/read back exactly on Galileo and its Aristotle state remains explicitly `PREPARED_NOT_SUBMITTED`.

## 90-second demo

Use `hackathon/demo-plan.md` exactly unless the live UI materially changes. The demo should show, in order:

1. the supply-chain trust gap;
2. real software `MATCH`;
3. controlled `MISMATCH` tamper moment;
4. Agent Skill correspondence versus security-audit separation;
5. real 0G Storage / Chain evidence;
6. the honesty boundary.

## Demo media copy

### Video title

ProofRail — Verifiable Software & Agent Skill Reproduction on 0G

### Short video description

ProofRail independently reproduces software and Agent Skills from an exact source commit, compares the distributed bytes, stores canonical evidence on 0G Storage, and anchors compact commitments on 0G Chain. This demo shows a real software `MATCH`, a controlled tamper `MISMATCH`, Agent Skill provenance versus security-audit separation, and real 0G evidence.

Live app: https://proofrail-app-production.up.railway.app

Source: https://github.com/Ollie202/proofrail-0g

### X post caption

A public GitHub repo does not prove the file users download actually came from that source.

Built **ProofRail** for the 0G Bridge Buildathon: exact-commit independent reproduction, real `MATCH` / `MISMATCH`, proof-verified 0G Storage evidence, 0G Chain commitments, and Agent Skill auditing where provenance stays separate from safety.

Live: https://proofrail-app-production.up.railway.app
Repo: https://github.com/Ollie202/proofrail-0g

#0G #Buildathon #Web3Security #AI

## Claims not to make

- Do not say ProofRail guarantees matched source is safe or benevolent.
- Do not say ProofRail automatically discovers the official repository.
- Do not say M7 Agent Skill evidence is registered on Aristotle mainnet; it is `PREPARED_NOT_SUBMITTED` there.
- Do not call the current output a TEE-attested artifact. The observed live TDX evidence proves the provider/runtime evidence level, but the artifact digest is not cryptographically bound into the legacy quote and artifact-in-TEE computation is not proven.
- Do not describe Supabase or Railway as proof authorities. They are product/runtime infrastructure around canonical verification evidence.

## Submission-day final check

Before pressing submit:

- sign in to the current AKINDO Bridge Buildathon page and read the exact live deadline + required fields;
- confirm the live app loads;
- record the final 90-second demo at readable zoom;
- replace the demo-video placeholder above with the final public/shareable URL;
- paste the repo, live app, demo, and evidence links;
- save/submit and confirm ProofRail appears as submitted on AKINDO.
