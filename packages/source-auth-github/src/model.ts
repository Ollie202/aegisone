/**
 * GitHub-specific source-authentication domain types. Nothing in this package leaks
 * into `@aegisone/capability-model`; it produces normalized authority observations
 * and canonical source-claim material that `apps/web` hands to `@aegisone/catalog-store`
 * for persistence. See docs/14-source-authentication.md.
 */

export interface GithubSourceAuthConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly appSlug: string | null;
  readonly callbackUrl: string;
  readonly stateSecret: string;
  /** Overridable for tests; defaults to global `fetch`. */
  readonly fetcher?: typeof fetch;
}

export interface GithubAuthenticatedUser {
  readonly id: number;
  readonly login: string;
}

export interface GithubInstallation {
  readonly id: number;
  readonly accountLogin: string | null;
  readonly accountId: number | null;
}

/** Normalized base repository permission. `maintain` is treated as sufficient
 * (effective push/write capability) per docs/14-source-authentication.md Step 4. */
export type NormalizedGithubPermission = "admin" | "maintain" | "write" | "triage" | "read" | "none";

export interface GithubInstallationRepository {
  readonly id: number;
  readonly nodeId: string | null;
  readonly fullName: string;
  readonly ownerLogin: string;
  readonly ownerId: number;
  readonly isPrivate: boolean;
  readonly defaultBranch: string;
  readonly permission: NormalizedGithubPermission;
}

export interface GithubRepository {
  readonly id: number;
  readonly nodeId: string | null;
  readonly fullName: string;
  readonly ownerLogin: string;
  readonly ownerId: number;
  readonly isPrivate: boolean;
  readonly defaultBranch: string;
}

export interface GithubCollaboratorPermission {
  readonly permission: NormalizedGithubPermission;
  readonly roleName: string | null;
}

export interface GithubResolvedCommit {
  readonly sha: string;
}

export interface CanonicalSourceClaimAuthority {
  readonly githubUserId: number;
  readonly githubLogin: string;
  readonly permission: NormalizedGithubPermission;
}

export interface CanonicalSourceClaimInput {
  readonly resourceId: string;
  readonly resourceVersionId: string;
  readonly provider: "github";
  readonly repository: { readonly id: number | null; readonly fullName: string };
  readonly source: { readonly commitSha: string; readonly subdirectory: string | null };
  readonly distribution?: { readonly url: string; readonly sha256: string | null } | null;
  readonly authority?: CanonicalSourceClaimAuthority | null;
}
