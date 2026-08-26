import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveSourceClaimTransition } from "../src/source-claim-transition.ts";

test("no active claims => new", () => {
  const result = resolveSourceClaimTransition([], 555, "acme/auditor");
  assert.deepEqual(result, { kind: "new" });
});

test("same stable repository id => supersede, never a conflict", () => {
  const result = resolveSourceClaimTransition(
    [{ id: "claim-1", sourceRepositoryId: 555, sourceRepository: "acme/auditor" }],
    555,
    "acme/auditor-renamed",
  );
  assert.deepEqual(result, { kind: "supersede", supersedesClaimId: "claim-1" });
});

test("different repository id => explicit conflict, never silently picked", () => {
  const result = resolveSourceClaimTransition(
    [{ id: "claim-1", sourceRepositoryId: 555, sourceRepository: "acme/auditor" }],
    999,
    "widgets/other",
  );
  assert.deepEqual(result, { kind: "conflict", conflictingClaimId: "claim-1" });
});

test("falls back to full-name match only when neither claim has a stable id", () => {
  const supersede = resolveSourceClaimTransition(
    [{ id: "claim-1", sourceRepositoryId: null, sourceRepository: "acme/auditor" }],
    null,
    "acme/auditor",
  );
  assert.deepEqual(supersede, { kind: "supersede", supersedesClaimId: "claim-1" });

  const conflict = resolveSourceClaimTransition(
    [{ id: "claim-1", sourceRepositoryId: null, sourceRepository: "acme/auditor" }],
    null,
    "widgets/other",
  );
  assert.deepEqual(conflict, { kind: "conflict", conflictingClaimId: "claim-1" });
});
