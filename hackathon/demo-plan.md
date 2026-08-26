# 90-Second Demo Plan

**Recording target:** https://proofrail-app-production.up.railway.app  
**Goal:** show the trust gap, a real MATCH, a real MISMATCH, Agent Skill audit separation, and real 0G evidence without waiting for a live build during the recording.

## Before recording

Open these tabs so there is no dead time:

1. Live AegisOne app.
2. Public GitHub repository.
3. M5 Aristotle registration transaction on 0G ChainScan.
4. M7 Galileo registration transaction on 0G ChainScan.

Record at a mobile-readable zoom. Do not expose Railway/Supabase dashboards or secrets.

## 0–12s — The trust gap

**Screen:** top of the AegisOne homepage.

**Say:**

> A public GitHub repo does not prove the file users download was actually built from that source. AegisOne rebuilds the exact declared commit independently and compares the bytes.

## 12–32s — Real software MATCH

**Screen:** scroll to **The core claim** and hold on the green MATCH card.

Show the real digest:

```text
Publisher   9978d500ee45216cb6c93b886857100ce95b63f6135dd339ace7ff533d9aa154
0G rebuild  9978d500ee45216cb6c93b886857100ce95b63f6135dd339ace7ff533d9aa154
            ----------------------------------------------------------------
MATCH
```

**Say:**

> This is a real 0G Sandbox reproduction. The publisher artifact and independent rebuild are byte-for-byte identical, so the cryptographic result is MATCH.

## 32–50s — Tamper moment

**Screen:** move directly to the red MISMATCH card.

```text
Tampered publisher  d5318963f53126b4c4bd448bffca222a8e08f068764e379516fc0ad3bd1f8889
Same 0G rebuild     9978d500ee45216cb6c93b886857100ce95b63f6135dd339ace7ff533d9aa154
                    ----------------------------------------------------------------
MISMATCH
```

**Say:**

> Now change only the distributed file. The source still looks clean, but the bytes no longer match. AegisOne reports MISMATCH while the independent reproduction stays unchanged.

## 50–66s — Agent Skills: provenance is not safety

**Screen:** Agent Skills section.

**Say:**

> AegisOne also verifies Agent Skills. Correspondence and security are separate. This skill matches source exactly, while deterministic static analysis reports its findings independently. A MATCH never means the skill is safe.

Point briefly to:

- package SHA-256 `fb33d14404f6b4b88666af027b9a22484d0df468e3c8343a1169358c2b78e878`;
- controlled substitution `da2f61f4da0662b6f05964834a95b7cfe0dbccb5eb69a3794e0e332ee12e54eb` → MISMATCH;
- clean fixture audit: `0 findings`, LLM advisory `NOT_RUN`.

## 66–84s — Follow the real 0G evidence

**Screen:** **Real 0G evidence** section; click one mainnet link if time permits.

**Say:**

> The canonical evidence is stored on 0G Storage, and compact commitments are registered on 0G Chain. The software vertical slice is already anchored on Aristotle mainnet, and the Agent Skill proof has an exact Galileo registry readback.

Evidence to show:

- M5 0G Storage root: `0xc727fe83637fa9e323c84f2f7507599c9778cc9081a5b762cf5ba4fd54bdf181`;
- M5 Aristotle registry: `0xeD2361a6B56dc0d4a7494F3a46BA47f352050BA4`;
- M5 mainnet registration tx: `0xeffe42c509522cbdb4c434022d5e2fbf58eaf42981ae491570af6373391826ac`;
- M7 0G Storage root: `0x8253719512604d9de7421d59ccba3a3a6a7501cd688f2615f0c3a62a16c4fe66`;
- M7 Galileo registration tx: `0xd274b52a05ca026b85836cefd28277fe7b87f3e0924f806d45f866671bb158db`.

## 84–90s — Close

**Screen:** honesty-boundary cards or top of page.

**Say:**

> AegisOne gives humans and agents evidence they can verify before trusting software. It proves correspondence without pretending that matching source automatically means safe.

## Claims not to make

- Do **not** say the M7 Agent Skill record is on Aristotle mainnet; it is `PREPARED_NOT_SUBMITTED`.
- Do **not** call the current build “TEE-attested output.” The live TDX evidence is provider/runtime evidence only; artifact-digest binding is unavailable.
- Do **not** say AegisOne discovers the official repository automatically. The demonstrated source assurance is publisher-declared unless stronger identity evidence exists.
