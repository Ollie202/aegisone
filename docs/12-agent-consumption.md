# Agent Consumption

## Principle

Agents should **use** ProofRail as software/capability-trust infrastructure. ProofRail itself does not need to become a generic AI agent.

The M8 agent flow is:

```text
agent intent
    ↓
ProofRail discovery
    ↓
candidate capabilities
    ↓
ProofRail evidence inspection
    ↓
consumer policy
    ↓
ALLOW / REVIEW / DENY
```

ProofRail does not automatically install or execute the returned resource.

## Existing deterministic CLI/JSON

The original machine interface remains useful:

```bash
proofrail verify artifact.tar.gz --record <id> --json
```

Agents/CI parse stable fields rather than terminal prose.

Historical example:

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

The evidence semantics remain deterministic and do not require an LLM.

## M8 discovery/read API

M8 adds a stable network interface so agents no longer need local CLI access to discover/inspect resources.

Discovery:

```text
POST /search
```

Stable read/policy API after M8.7:

```text
GET  /api/v1/resources/:resourceId
GET  /api/v1/resources/:resourceId/evidence
POST /api/v1/policy/evaluate
```

These responses keep discovery, source assurance, correspondence, security and canonical evidence separate.

## M8 MCP interface

M8.8 exposes ProofRail through MCP as a thin wrapper over the same backend services.

Initial tools:

### `proofrail_search`

Purpose: find capabilities relevant to the user's/agent's intent.

Expected input concept:

```json
{
  "query": "review my Solidity smart contract",
  "types": ["agent-skill"],
  "limit": 10
}
```

Output includes resource identifiers, type, descriptions/provider attribution, relevance/discovery state and available ProofRail evidence summaries.

Relevance remains discovery-only.

### `proofrail_inspect`

Purpose: inspect the evidence dimensions for one resource/version.

Output should expose independently:

- source assurance and exact source claim;
- source inspection;
- distribution correspondence;
- security assessment;
- canonical evidence/0G pointers/freshness;
- unavailable/missing evidence explicitly.

### `proofrail_evaluate`

Purpose: apply a caller-supplied deterministic trust policy to a resource's validated ProofRail evidence.

Output:

```text
ALLOW
REVIEW
DENY
```

plus structured reasons.

The MCP handler uses the same M8.1 policy evaluator as REST. It may not let an LLM override a reason/verdict.

## Forbidden initial MCP capabilities

M8 does not expose:

- automatic Skill installation;
- automatic MCP connection;
- arbitrary execution/build submission;
- signing/0G wallet operations;
- secret upload;
- generic remote shell.

The user/consuming agent makes the final installation/execution decision after evidence/policy evaluation.

## Example M8 agent policy

```json
{
  "schemaVersion": "1",
  "minimumSourceAssurance": "REPOSITORY_AUTHENTICATED",
  "requireCorrespondence": "MATCH",
  "maximumAuditSeverity": "MEDIUM",
  "maximumEvidenceAgeHours": 168,
  "missingEvidenceDecision": "DENY"
}
```

A discovery result with no ProofRail evidence can still be returned by search, but this policy would deny/review it because required evidence is missing.

## Winner demo consumption path

The M8.9 demo target is a real coding-agent client performing:

```text
proofrail_search("pull request review")
        ↓
proofrail_inspect(genuine-skill)
        ↓
proofrail_evaluate(policy requiring MATCH)
        ↓
ALLOW
```

Then a controlled substituted distribution with the same claimed source/identity produces:

```text
MISMATCH
   ↓
proofrail_evaluate(...)
   ↓
DENY
```

This demonstrates that an agent can use ProofRail before trusting an externally discovered capability.

## Source authentication from an agent's perspective

An agent should not infer authenticated source from a GitHub URL.

ProofRail exposes source assurance levels:

- `NONE`
- `DECLARED`
- `REPOSITORY_AUTHENTICATED`
- `SIGNED_RELEASE` when actually cryptographically verified

An autonomous installer can require a minimum assurance through policy.

The interactive GitHub App OAuth/source-claim flow itself remains human/browser-authenticated in M8; MCP does not accept GitHub credentials/secrets.

## Builder/verifier agents — later

A future open verification network may represent independent builders as agents with:

- portable identity;
- declared capabilities;
- build history;
- attestation/evidence history;
- reputation/validation records.

0G Agentic ID / ERC-8004-compatible identity/reputation may be relevant, but identity never proves output correctness. Reproduction evidence still does that job.

## Where an LLM may help later

When independent builders disagree:

```text
Builder A -> ABC
Builder B -> XYZ
```

Cryptography already establishes divergence/mismatch.

An LLM/0G Compute may inspect logs, dependencies, compiler versions, timestamps, locales or environment differences and suggest *why* the build diverged.

That diagnosis remains advisory and cannot change correspondence or deterministic consumer policy.

## Integration boundary

MCP and REST are convenience transports over the same ProofRail evidence model. Neither transport is a trust primitive.

See:

- `docs/05-api-contracts.md`
- `docs/13-m8-backend-blueprint.md`
- `docs/17-m8-security-boundaries.md`
