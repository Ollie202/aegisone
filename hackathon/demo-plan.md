# 90-Second Demo Plan

## 0–12s — The trust gap

Show a public GitHub repo beside its downloadable release artifact.

Message:

> **Seeing the source does not prove these downloaded bytes came from that source.**

## 12–25s — Pin the claim

Show:
- publisher/source claim;
- exact immutable commit;
- constrained build recipe;
- publisher artifact SHA-256.

Label source assurance honestly (`DECLARED` unless stronger identity proof exists).

## 25–50s — Independent 0G reproduction

Run/build the exact commit through the real 0G path.

Show:

```text
Publisher artifact   ABC123
0G rebuild           ABC123
                     ------
MATCH                ✓
```

Briefly expose Storage/mainnet/TEE evidence links.

## 50–70s — Tamper/substitution moment

Replace or mutate the published artifact and run verification again.

```text
Local/published file 999XYZ
Verified reproduction ABC123
                      ------
MISMATCH              ✕
```

Message:

> **The source can still look clean while the file users receive has changed.**

## 70–90s — Network future

Show one policy visual:

```text
Builder A  ABC ✓
Builder B  ABC ✓
Builder C  ABC ✓
Policy: 3/3 + >=1 TEE -> PASS
```

Close:

> **Wave 3 proves one independent reproduction. Waves 4–5 turn it into a verification network that humans and agents can enforce before executing software.**
