import type { VerificationJson } from "../../core/src/model.ts";
import type {
  EvidencePointers,
  JobStore,
  NewVerificationJob,
  VerificationJob,
  VerificationJobFailure,
  VerificationJobPatch,
  VerificationJobStatus,
  ArtifactKind,
} from "./model.ts";
import { EMPTY_EVIDENCE_POINTERS } from "./model.ts";

interface SupabaseJobRow {
  id: string;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
  status: VerificationJobStatus;
  artifact_kind: ArtifactKind;
  project_id: string;
  source_repository: string;
  source_commit_sha: string;
  source_subdirectory: string | null;
  publisher_artifact_name: string;
  publisher_artifact_sha256: string | null;
  manifest_sha256: string | null;
  storage_root: string | null;
  storage_transaction: string | null;
  registry_contract: string | null;
  registry_transaction: string | null;
  registry_record_id: string | null;
  verification_json: VerificationJson | null;
  failure_code: string | null;
  failure_message: string | null;
}

export interface SupabaseJobStoreConfig {
  url: string;
  serviceRoleKey: string;
  fetcher?: typeof fetch;
}

function rowToJob(row: SupabaseJobRow): VerificationJob {
  const evidence: EvidencePointers = {
    manifestSha256: row.manifest_sha256,
    storageRoot: row.storage_root,
    storageTransaction: row.storage_transaction,
    registryContract: row.registry_contract,
    registryTransaction: row.registry_transaction,
    registryRecordId: row.registry_record_id,
  };
  const failure: VerificationJobFailure | null = row.failure_code && row.failure_message
    ? { code: row.failure_code, message: row.failure_message }
    : null;
  return {
    id: row.id,
    ownerId: row.owner_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: row.status,
    artifactKind: row.artifact_kind,
    projectId: row.project_id,
    sourceRepository: row.source_repository,
    sourceCommitSha: row.source_commit_sha,
    sourceSubdirectory: row.source_subdirectory,
    publisherArtifactName: row.publisher_artifact_name,
    publisherArtifactSha256: row.publisher_artifact_sha256,
    evidence,
    verificationJson: row.verification_json,
    failure,
  };
}

function patchToRow(patch: VerificationJobPatch): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.publisherArtifactSha256 !== undefined) row.publisher_artifact_sha256 = patch.publisherArtifactSha256;
  if (patch.verificationJson !== undefined) row.verification_json = patch.verificationJson;
  if (patch.failure !== undefined) {
    row.failure_code = patch.failure?.code ?? null;
    row.failure_message = patch.failure?.message ?? null;
  }
  if (patch.evidence) {
    if (patch.evidence.manifestSha256 !== undefined) row.manifest_sha256 = patch.evidence.manifestSha256;
    if (patch.evidence.storageRoot !== undefined) row.storage_root = patch.evidence.storageRoot;
    if (patch.evidence.storageTransaction !== undefined) row.storage_transaction = patch.evidence.storageTransaction;
    if (patch.evidence.registryContract !== undefined) row.registry_contract = patch.evidence.registryContract;
    if (patch.evidence.registryTransaction !== undefined) row.registry_transaction = patch.evidence.registryTransaction;
    if (patch.evidence.registryRecordId !== undefined) row.registry_record_id = patch.evidence.registryRecordId;
  }
  return row;
}

export class SupabaseJobStore implements JobStore {
  readonly #baseUrl: string;
  readonly #key: string;
  readonly #fetcher: typeof fetch;

  constructor(config: SupabaseJobStoreConfig) {
    this.#baseUrl = config.url.replace(/\/$/, "");
    this.#key = config.serviceRoleKey;
    this.#fetcher = config.fetcher ?? fetch;
  }

  #headers(preferRepresentation = false): Record<string, string> {
    return {
      apikey: this.#key,
      authorization: `Bearer ${this.#key}`,
      "content-type": "application/json",
      ...(preferRepresentation ? { prefer: "return=representation" } : {}),
    };
  }

  #url(search?: URLSearchParams): string {
    const suffix = search && [...search].length > 0 ? `?${search.toString()}` : "";
    return `${this.#baseUrl}/rest/v1/verification_jobs${suffix}`;
  }

  async #rows(response: Response): Promise<SupabaseJobRow[]> {
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 1_000);
      throw new Error(`Supabase job store request failed (${response.status}): ${detail}`);
    }
    return await response.json() as SupabaseJobRow[];
  }

  async create(input: NewVerificationJob): Promise<VerificationJob> {
    const body = {
      owner_id: input.ownerId ?? null,
      status: "queued",
      artifact_kind: input.artifactKind ?? "software",
      project_id: input.projectId,
      source_repository: input.sourceRepository,
      source_commit_sha: input.sourceCommitSha,
      source_subdirectory: input.sourceSubdirectory ?? null,
      publisher_artifact_name: input.publisherArtifactName,
      publisher_artifact_sha256: input.publisherArtifactSha256 ?? null,
      ...{
        manifest_sha256: EMPTY_EVIDENCE_POINTERS.manifestSha256,
        storage_root: EMPTY_EVIDENCE_POINTERS.storageRoot,
        storage_transaction: EMPTY_EVIDENCE_POINTERS.storageTransaction,
        registry_contract: EMPTY_EVIDENCE_POINTERS.registryContract,
        registry_transaction: EMPTY_EVIDENCE_POINTERS.registryTransaction,
        registry_record_id: EMPTY_EVIDENCE_POINTERS.registryRecordId,
      },
    };
    const params = new URLSearchParams({ select: "*" });
    const rows = await this.#rows(await this.#fetcher(this.#url(params), {
      method: "POST",
      headers: this.#headers(true),
      body: JSON.stringify(body),
    }));
    if (rows.length !== 1) throw new Error(`Expected one created verification job, received ${rows.length}`);
    return rowToJob(rows[0]!);
  }

  async get(id: string): Promise<VerificationJob | null> {
    const params = new URLSearchParams({ select: "*", id: `eq.${id}`, limit: "1" });
    const rows = await this.#rows(await this.#fetcher(this.#url(params), { headers: this.#headers() }));
    return rows[0] ? rowToJob(rows[0]) : null;
  }

  async list(ownerId?: string | null): Promise<VerificationJob[]> {
    const params = new URLSearchParams({ select: "*", order: "created_at.desc" });
    if (ownerId !== undefined) params.set("owner_id", ownerId === null ? "is.null" : `eq.${ownerId}`);
    const rows = await this.#rows(await this.#fetcher(this.#url(params), { headers: this.#headers() }));
    return rows.map(rowToJob);
  }

  async update(id: string, patch: VerificationJobPatch): Promise<VerificationJob> {
    const params = new URLSearchParams({ select: "*", id: `eq.${id}` });
    const rows = await this.#rows(await this.#fetcher(this.#url(params), {
      method: "PATCH",
      headers: this.#headers(true),
      body: JSON.stringify(patchToRow(patch)),
    }));
    if (rows.length !== 1) throw new Error(`Unknown verification job: ${id}`);
    return rowToJob(rows[0]!);
  }
}
