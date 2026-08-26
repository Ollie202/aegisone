import type { NormalizedGithubPermission } from "./model.ts";

/**
 * The M8 authority ladder (docs/14-source-authentication.md Step 4,
 * docs/17-m8-security-boundaries.md Threat M8-008):
 *
 *   admin, write/push, maintain (effective push/write) => sufficient
 *   read, triage, none, unknown                        => insufficient, never upgrades assurance
 */
const SUFFICIENT: ReadonlySet<NormalizedGithubPermission> = new Set(["admin", "write", "maintain"]);

export function hasSufficientRepositoryAuthority(permission: NormalizedGithubPermission | null | undefined): boolean {
  if (!permission) return false;
  return SUFFICIENT.has(permission);
}

/** Normalizes the `permission`/`role_name` shape returned by
 * `GET /repos/{owner}/{repo}/collaborators/{username}/permission`. Custom/maintain roles are
 * reduced carefully to an accepted base capability rather than guessed from a label alone;
 * anything not explicitly recognized is treated as insufficient ("none"). */
export function normalizeCollaboratorPermission(permission: string, roleName: string | null): NormalizedGithubPermission {
  const value = permission.toLowerCase();
  // Some deployments surface "maintain" only via role_name with a base permission of "write".
  if (value === "write" && roleName?.toLowerCase() === "maintain") return "maintain";
  if (value === "admin" || value === "write" || value === "read" || value === "triage" || value === "none") {
    return value;
  }
  return "none";
}

/** Normalizes the boolean `permissions` flag object returned on repository objects from
 * `GET /user/installations/{id}/repositories` and `GET /repos/{owner}/{repo}`. */
export function normalizePermissionFlags(flags: {
  admin?: boolean;
  maintain?: boolean;
  push?: boolean;
  triage?: boolean;
  pull?: boolean;
} | null | undefined): NormalizedGithubPermission {
  if (!flags) return "none";
  if (flags.admin) return "admin";
  if (flags.maintain) return "maintain";
  if (flags.push) return "write";
  if (flags.triage) return "triage";
  if (flags.pull) return "read";
  return "none";
}
