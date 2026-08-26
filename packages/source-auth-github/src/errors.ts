export type GithubSourceAuthErrorCode =
  | "oauth_state_invalid"
  | "oauth_state_expired"
  | "oauth_token_exchange_failed"
  | "github_user_lookup_failed"
  | "github_installations_lookup_failed"
  | "github_installation_repositories_lookup_failed"
  | "github_repository_not_found"
  | "github_commit_not_found"
  | "github_permission_lookup_failed"
  | "github_response_too_large"
  | "github_network_error"
  | "github_timeout"
  | "github_malformed_response";

export class GithubSourceAuthError extends Error {
  readonly code: GithubSourceAuthErrorCode;
  readonly status: number;

  constructor(code: GithubSourceAuthErrorCode, message: string, status = 502) {
    super(message);
    this.name = "GithubSourceAuthError";
    this.code = code;
    this.status = status;
  }
}
