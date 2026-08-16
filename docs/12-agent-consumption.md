# Agent Consumption

## Principle

Agents should **use** ProofRail as software-trust infrastructure. ProofRail itself does not need to become a generic AI agent.

## Wave 3 — No MCP required

The first machine interface is deterministic CLI/JSON:

```bash
proofrail verify artifact.tar.gz --record <id> --json
```

An agent can parse stable fields and enforce its own policy.

Example:

```json
{
  "status": "MATCH",
  "sourceAssurance": "DECLARED",
  "independentReproductions": 1,
  "matchingReproductions": 1,
  "teeEvidence": "AVAILABLE",
  "policyPassed": true
}
```

This requires no LLM and no MCP server.

## Later interfaces

Once the evidence model is stable:
- REST API for services/CI;
- TypeScript SDK;
- GitHub Action/admission hooks;
- MCP server for coding/operations agents.

All interfaces wrap the same deterministic verification engine.

## Builder/verifier agents

Wave 4/5 may represent independent builders as agents with:
- portable identity;
- declared capabilities;
- build history;
- attestation/evidence history;
- reputation/validation records.

0G Agentic ID and ERC-8004-compatible identity/reputation are relevant here, but identity does not prove output correctness. Reproduction evidence still does that job.

## Where an LLM helps

When builders disagree:

```text
Builder A -> ABC
Builder B -> XYZ
```

Cryptography already establishes `DIVERGED`.

An LLM/0G Compute may inspect build logs, dependency graphs, compiler versions, timestamps, locales, or environment differences and suggest *why* the build diverged.

The diagnosis is advisory. It cannot turn a mismatch into a match.

## Example agent policy

An autonomous installer could enforce:

1. source assurance is at least repository-authenticated;
2. minimum two independent matching builders;
3. at least one TEE-backed builder;
4. local downloaded artifact hash equals the consensus artifact digest;
5. otherwise refuse execution and explain missing evidence.
