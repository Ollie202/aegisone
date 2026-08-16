# API & Interface Contracts

These interfaces are provisional until the first technical spike.

## CLI

### `proofrail verify <artifact>`
Goal: independently hash a local file and compare it against a supplied/resolved provenance record.

Expected options later:
- `--manifest <path|root>`
- `--record <id|tx>`
- `--json`

### `proofrail inspect <record>`
Displays raw evidence and verification level without rebuilding.

### `proofrail build`
Wave 3 target only after runner behavior is proven.

## Runner interface

Conceptual TypeScript boundary:

```ts
interface BuildRunner {
  build(request: BuildRequest): Promise<BuildResult>;
}
```

A runner must not report capabilities it cannot prove.

## Storage interface

```ts
interface EvidenceStore {
  put(bytes: Uint8Array): Promise<StoredEvidence>;
  get(id: string, verify?: boolean): Promise<Uint8Array>;
}
```

## Registry interface

```ts
interface VerificationRegistry {
  register(record: RegistryWrite): Promise<RegistryReceipt>;
  resolve(id: string): Promise<RegistryRead | null>;
}
```

## Web API

Avoid defining a large backend before the vertical slice works. The first web UI may read a small server-side verification service or directly consume public evidence where safe.
