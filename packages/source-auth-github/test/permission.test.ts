import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hasSufficientRepositoryAuthority,
  normalizeCollaboratorPermission,
  normalizePermissionFlags,
} from "../src/permission.ts";

test("admin/write/maintain are sufficient authority", () => {
  assert.ok(hasSufficientRepositoryAuthority("admin"));
  assert.ok(hasSufficientRepositoryAuthority("write"));
  assert.ok(hasSufficientRepositoryAuthority("maintain"));
});

test("read/triage/none/unknown/null are never sufficient", () => {
  assert.ok(!hasSufficientRepositoryAuthority("read"));
  assert.ok(!hasSufficientRepositoryAuthority("triage"));
  assert.ok(!hasSufficientRepositoryAuthority("none"));
  assert.ok(!hasSufficientRepositoryAuthority(null));
  assert.ok(!hasSufficientRepositoryAuthority(undefined));
});

test("normalizeCollaboratorPermission recognizes standard base permissions", () => {
  assert.equal(normalizeCollaboratorPermission("admin", null), "admin");
  assert.equal(normalizeCollaboratorPermission("write", "write"), "write");
  assert.equal(normalizeCollaboratorPermission("read", "read"), "read");
  assert.equal(normalizeCollaboratorPermission("triage", "triage"), "triage");
  assert.equal(normalizeCollaboratorPermission("none", null), "none");
});

test("normalizeCollaboratorPermission maps a write base with maintain role_name to maintain", () => {
  assert.equal(normalizeCollaboratorPermission("write", "maintain"), "maintain");
});

test("normalizeCollaboratorPermission never invents sufficiency from an unrecognized label", () => {
  assert.equal(normalizeCollaboratorPermission("custom-role", "custom-role"), "none");
});

test("normalizePermissionFlags maps boolean flag objects, most-privileged first", () => {
  assert.equal(normalizePermissionFlags({ admin: true, push: true, pull: true }), "admin");
  assert.equal(normalizePermissionFlags({ maintain: true, push: true }), "maintain");
  assert.equal(normalizePermissionFlags({ push: true, pull: true }), "write");
  assert.equal(normalizePermissionFlags({ triage: true, pull: true }), "triage");
  assert.equal(normalizePermissionFlags({ pull: true }), "read");
  assert.equal(normalizePermissionFlags({}), "none");
  assert.equal(normalizePermissionFlags(null), "none");
});
