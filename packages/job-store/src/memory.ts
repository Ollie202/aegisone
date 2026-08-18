import { randomUUID } from "node:crypto";
import type { JobStore, NewVerificationJob, VerificationJob, VerificationJobPatch } from "./model.ts";
import { EMPTY_EVIDENCE_POINTERS } from "./model.ts";

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class InMemoryJobStore implements JobStore {
  readonly #jobs = new Map<string, VerificationJob>();

  async create(input: NewVerificationJob): Promise<VerificationJob> {
    const now = new Date().toISOString();
    const job: VerificationJob = {
      id: randomUUID(),
      ownerId: input.ownerId ?? null,
      createdAt: now,
      updatedAt: now,
      status: "queued",
      artifactKind: input.artifactKind ?? "software",
      projectId: input.projectId,
      sourceRepository: input.sourceRepository,
      sourceCommitSha: input.sourceCommitSha,
      sourceSubdirectory: input.sourceSubdirectory ?? null,
      publisherArtifactName: input.publisherArtifactName,
      publisherArtifactSha256: input.publisherArtifactSha256 ?? null,
      evidence: clone(EMPTY_EVIDENCE_POINTERS),
      verificationJson: null,
      failure: null,
    };
    this.#jobs.set(job.id, job);
    return clone(job);
  }

  async get(id: string): Promise<VerificationJob | null> {
    const job = this.#jobs.get(id);
    return job ? clone(job) : null;
  }

  async list(ownerId?: string | null): Promise<VerificationJob[]> {
    return [...this.#jobs.values()]
      .filter((job) => ownerId === undefined || job.ownerId === ownerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(clone);
  }

  async update(id: string, patch: VerificationJobPatch): Promise<VerificationJob> {
    const current = this.#jobs.get(id);
    if (!current) throw new Error(`Unknown verification job: ${id}`);
    const next: VerificationJob = {
      ...current,
      ...patch,
      evidence: patch.evidence ? { ...current.evidence, ...patch.evidence } : current.evidence,
      updatedAt: new Date().toISOString(),
    };
    this.#jobs.set(id, next);
    return clone(next);
  }
}
