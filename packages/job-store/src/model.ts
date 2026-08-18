import type { VerificationJson } from "../../core/src/model.ts";

export type VerificationJobStatus = "queued" | "running" | "verified" | "failed";
export type ArtifactKind = "software" | "agent-skill";

export interface EvidencePointers {
  manifestSha256: string | null;
  storageRoot: string | null;
  storageTransaction: string | null;
  registryContract: string | null;
  registryTransaction: string | null;
  registryRecordId: string | null;
}

export interface VerificationJobFailure {
  code: string;
  message: string;
}

export interface VerificationJob {
  id: string;
  ownerId: string | null;
  createdAt: string;
  updatedAt: string;
  status: VerificationJobStatus;
  artifactKind: ArtifactKind;
  projectId: string;
  sourceRepository: string;
  sourceCommitSha: string;
  sourceSubdirectory: string | null;
  publisherArtifactName: string;
  publisherArtifactSha256: string | null;
  evidence: EvidencePointers;
  verificationJson: VerificationJson | null;
  failure: VerificationJobFailure | null;
}

export interface NewVerificationJob {
  ownerId?: string | null;
  artifactKind?: ArtifactKind;
  projectId: string;
  sourceRepository: string;
  sourceCommitSha: string;
  sourceSubdirectory?: string | null;
  publisherArtifactName: string;
  publisherArtifactSha256?: string | null;
}

export interface VerificationJobPatch {
  status?: VerificationJobStatus;
  publisherArtifactSha256?: string | null;
  evidence?: Partial<EvidencePointers>;
  verificationJson?: VerificationJson | null;
  failure?: VerificationJobFailure | null;
}

export interface JobStore {
  create(input: NewVerificationJob): Promise<VerificationJob>;
  get(id: string): Promise<VerificationJob | null>;
  list(ownerId?: string | null): Promise<VerificationJob[]>;
  update(id: string, patch: VerificationJobPatch): Promise<VerificationJob>;
}

export const EMPTY_EVIDENCE_POINTERS: EvidencePointers = {
  manifestSha256: null,
  storageRoot: null,
  storageTransaction: null,
  registryContract: null,
  registryTransaction: null,
  registryRecordId: null,
};
