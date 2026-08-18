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
  publishableKey: string;
  appToken: string;
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
  readonly #publishableKey: string;
  readonly #appToken: string;
  readonly #fetcher: typeof fetch;

  constructor(config: SupabaseJobStoreConfig) {
    this.#baseUrl = config.url.replace(/\/$/, "");
    this.#publishableKey = config.publishableKey;
    this.#appToken = config.appToken;
    this.#fetcher = config.fetcher ?? fetch;
  }

  #headers(): Record<string, string> {
    return {
      apikey: this.#publishableKey,
      authorization: `Bearer ${this.#publishableKey}`,
      "content-type": "application/json",
      "cache-control": "no-store",
    };
  }

  async #rpc(name: string, body: Record<string, unknown>): Promise<SupabaseJobRow[]> {
    const response = await this.#fetcher(`${this.#baseUrl}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: this.#headers(),
      body: JSON.stringify({ p_token: this.#appToken, ...body }),
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 1_000);
      throw new Error(`Supabase job store RPC failed (${response.status}): ${detail}`);
    }
    return await response.json() as SupabaseJobRow[];
  }

  async create(input: NewVerificationJob): Promise<VerificationJob> {
    const rows = await this.#rpc("proofrail_job_create", {
      p_owner_id: input.ownerId ?? null,
      p_artifact_kind: input.artifactKind ?? "software",
      p_project_id: input.projectId,
      p_source_repository: input.sourceRepository,
      p_source_commit_sha: input.sourceCommitSha,
      p_source_subdirectory: input.sourceSubdirectory ?? null,
      p_publisher_artifact_name: input.publisherArtifactName,
      p_publisher_artifact_sha256: input.publisherArtifactSha256 ?? null,
    });
    if (rows.length !== 1) throw new Error(`Expected one created verification job, received ${rows.length}`);
    return rowToJob(rows[0]!);
  }

  async get(id: string): Promise<VerificationJob | null> {
    const rows = await this.#rpc("proofrail_job_get", { p_id: id });
    return rows[0] ? rowToJob(rows[0]) : null;
  }

  async list(ownerId?: string | null): Promise<VerificationJob[]> {
    const rows = await this.#rpc("proofrail_job_list", {
      p_filter_owner: ownerId !== undefined,
      p_owner_id: ownerId ?? null,
    });
    return rows.map(rowToJob);
  }

  async update(id: string, patch: VerificationJobPatch): Promise<VerificationJob> {
    const rows = await this.#rpc("proofrail_job_update", { p_id: id, p_patch: patchToRow(patch) });
    if (rows.length !== 1) throw new Error(`Unknown verification job: ${id}`);
    return rowToJob(rows[0]!);
  }
}
