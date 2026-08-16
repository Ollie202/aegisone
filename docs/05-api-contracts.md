# API & Interface Contracts

Interfaces are provisional until M1/M4 prove the underlying behavior.

## CLI

### `proofrail verify <artifact>`
Hash a local artifact, resolve supplied evidence, and evaluate correspondence/policy without rebuilding.

Expected options:
- `--manifest <path|root>`
- `--record <id|tx>`
- `--json`

### `proofrail reproduce <claim|manifest>`
Independently rebuild an exact source claim using the configured runner and compare produced artifact bytes with the publisher artifact.

Wave 3 may initially expose this through an internal/dev command before polishing it.

### `proofrail inspect <record>`
Display source-claim identity, raw evidence, digests, attestation capabilities, and registry/storage references.

## Stable JSON principle

Agents and CI should not scrape human terminal copy. Machine output must use versioned enums/fields, for example:

```json
{
  "schemaVersion": 1,
  "sourceClaim": {
    "assurance": "DECLARED",
    "repository": "https://github.com/acme/wallet",
    "commit": "7c91ab..."
  },
  "publisherArtifact": { "sha256": "ABC123..." },
  "reproductions": [
    { "runner": "0g", "sha256": "ABC123...", "match": true }
  ],
  "status": "MATCH",
  "policy": { "passed": true }
}
```

No LLM output participates in `status`.

## Core interfaces

```ts
interface SourceClaimVerifier {
  verify(claim: ReleaseClaim): Promise<SourceClaimAssessment>;
}

interface BuildRunner {
  build(request: BuildRequest): Promise<BuildResult>;
}

interface EvidenceStore {
  put(bytes: Uint8Array): Promise<StoredEvidence>;
  get(id: string, verify?: boolean): Promise<Uint8Array>;
}

interface VerificationRegistry {
  register(record: RegistryWrite): Promise<RegistryReceipt>;
  resolve(id: string): Promise<RegistryRead | null>;
}
```

## Agent interfaces

**Wave 3:** CLI + `--json` is sufficient.

**Later:** REST API, TypeScript SDK, and MCP server may wrap the same deterministic core. MCP is an integration convenience, not a trust primitive.
