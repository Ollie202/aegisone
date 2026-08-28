import type { CapabilityTrustEvidence } from "../../../packages/capability-model/src/index.ts";
import type { StoragePublicationIntegrity } from "../../../packages/evidence-publish/src/integrity.ts";

/**
 * ============================================================================================
 * THE FOUR LIBRARY STATES — INDEPENDENT FACTS, NOT A SCORE
 * ============================================================================================
 * The Verified Library shows four things about a resource. They are deliberately NOT a ladder a
 * resource climbs, NOT summed into a rating, and NOT collapsed into a single badge:
 *
 *   INDEXED       a discovery provider (or this repository, for a seeded fixture) recorded it.
 *                 Proves nothing about the publisher, the bytes, or safety.
 *
 *   AUDITED       AegisOne's deterministic static Agent Skill audit genuinely ran to completion.
 *                 A completed audit with zero findings is NOT a safety guarantee — it is the
 *                 absence of the specific patterns the auditor looks for.
 *
 *   VERIFIED      correspondence is a real `MATCH`: a distinct distributed artifact was compared
 *                 with an independent exact-source reproduction and the bytes were equal. Never
 *                 inferred, never implied by an audit passing, and never derived from a DB row
 *                 alone — `assembleTrustEvidence` re-checks the row's own invariants first.
 *                 MATCH does not mean safe.
 *
 *   STORED ON 0G  an evidence bundle for this resource genuinely exists on 0G Storage: a real
 *                 root that passed `checkStoragePublicationIntegrity`, which recomputes the
 *                 canonical evidence manifest (root included) and requires it to equal the stored
 *                 digest. Locating evidence is not a verdict about the resource.
 *
 * A resource can be AUDITED without being VERIFIED, VERIFIED without being STORED ON 0G, and — in
 * principle — STORED ON 0G while its correspondence is still unevaluated, because storing evidence
 * and reproducing bytes are different acts. Every state is rendered as present or explicitly
 * absent, never as a partial or implied value.
 */

export type LibraryStateId = "INDEXED" | "AUDITED" | "VERIFIED" | "STORED_ON_0G";

export interface LibraryStateFact {
  readonly id: LibraryStateId;
  /** Whether this specific fact is genuinely established for this resource. */
  readonly present: boolean;
  /** What is shown when the fact is absent. Always phrased as missing evidence about AegisOne's
   * knowledge, never as a negative finding about the resource. */
  readonly absentReason: string | null;
}

export interface LibraryStates {
  readonly indexed: LibraryStateFact;
  readonly audited: LibraryStateFact;
  readonly verified: LibraryStateFact;
  readonly storedOn0g: LibraryStateFact;
}

export interface LibraryStateInput {
  readonly discoveryStatus: string;
  readonly trust: CapabilityTrustEvidence;
  readonly storagePublication: StoragePublicationIntegrity;
}

/**
 * Derives the four facts. Reads only already-assembled, already-integrity-checked evidence — it
 * performs no verification of its own and can only ever *narrow* what the assembler produced.
 */
export function deriveLibraryStates(input: LibraryStateInput): LibraryStates {
  const { trust, storagePublication } = input;

  const indexed: LibraryStateFact = {
    id: "INDEXED",
    present: input.discoveryStatus === "INDEXED" || input.discoveryStatus === "STALE",
    absentReason: input.discoveryStatus === "INDEXED" || input.discoveryStatus === "STALE"
      ? null
      : "no current discovery record",
  };

  const auditRan = trust.security.status === "COMPLETED";
  const audited: LibraryStateFact = {
    id: "AUDITED",
    present: auditRan,
    absentReason: auditRan ? null : "the deterministic audit has not been run for this resource",
  };

  // Only a genuine MATCH. DIVERGED, INSUFFICIENT_EVIDENCE, MISMATCH and NOT_EVALUATED are all
  // "not verified", and each is shown as itself elsewhere rather than flattened to a failure.
  const isMatch = trust.correspondence.status === "MATCH";
  const verified: LibraryStateFact = {
    id: "VERIFIED",
    present: isMatch,
    absentReason: isMatch
      ? null
      : trust.correspondence.status === "NOT_EVALUATED"
        ? "correspondence has not been evaluated: no independent reproduction has been compared with a distributed artifact"
        : `correspondence is ${trust.correspondence.status}, not MATCH`,
  };

  /**
   * The gate result is the ONLY input here. Note what is deliberately not consulted: the raw
   * `storage_root` column. `trust.canonicalEvidence.storageRoot` is already null unless the gate
   * passed, and this reads the gate itself, so there are two independent reasons a fabricated row
   * cannot produce this state.
   */
  const stored = storagePublication.ok;
  const storedOn0g: LibraryStateFact = {
    id: "STORED_ON_0G",
    present: stored,
    absentReason: stored
      ? null
      : storagePublication.reason === "NO_PUBLICATION_RECORDED"
        ? "no evidence bundle has been published to 0G Storage for this resource yet"
        : "a 0G publication is recorded but failed its integrity re-check, so AegisOne will not present it",
  };

  return { indexed, audited, verified, storedOn0g };
}

/** Human label for each state. Kept beside the derivation so a label can never drift from the fact
 * it names. Never a generic SAFE/TRUSTED word. */
export function libraryStateLabel(id: LibraryStateId): string {
  switch (id) {
    case "INDEXED":
      return "INDEXED";
    case "AUDITED":
      return "AUDITED";
    case "VERIFIED":
      return "VERIFIED";
    case "STORED_ON_0G":
      return "STORED ON 0G";
  }
}

/** One-line meaning, shown next to the label so the state is never a bare word. */
export function libraryStateMeaning(id: LibraryStateId): string {
  switch (id) {
    case "INDEXED":
      return "Discovered and catalogued. Not a verification.";
    case "AUDITED":
      return "The deterministic static audit completed. Not a safety guarantee.";
    case "VERIFIED":
      return "Reproduced bytes matched the distributed artifact. Not a safety guarantee.";
    case "STORED_ON_0G":
      return "An evidence bundle is retrievable from 0G Storage. Not a verdict.";
  }
}
