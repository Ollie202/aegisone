# 90-Second Demo Plan

## 0-10s — Problem

Show a public GitHub repo and a downloadable release artifact.

Message: **Public source does not automatically prove the downloaded file was built from that source.**

## 10-30s — Build evidence

Show the exact commit and the real ProofRail build/evidence path through 0G. Keep infrastructure labels visible but do not explain every protocol detail.

## 30-50s — Independent verification

Run:

```bash
proofrail verify demo-artifact.tar.gz
```

Show:
- source commit;
- artifact SHA-256;
- 0G Storage evidence;
- 0G mainnet registry record;
- available TEE evidence level;
- PASS.

## 50-70s — Tamper moment

Modify/replace one byte/file in the artifact and rerun verification.

Show a clear failure:

`ARTIFACT DIGEST MISMATCH — DO NOT TREAT THIS FILE AS THE REGISTERED BUILD`

## 70-90s — Scale

One sentence on Wave 4/5:

**Today one verifiable build. Next, multiple independent builders reproduce the same source and ProofRail only upgrades trust when their outputs agree.**
