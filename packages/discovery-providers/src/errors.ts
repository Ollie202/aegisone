export type DiscoveryProviderErrorCode =
  | "invalid_request"
  | "disallowed_origin"
  | "redirect_blocked"
  | "timeout"
  | "deadline_exceeded"
  | "network_error"
  | "upstream_error"
  | "response_too_large"
  | "malformed_response";

export class DiscoveryProviderError extends Error {
  readonly code: DiscoveryProviderErrorCode;

  constructor(code: DiscoveryProviderErrorCode, message: string) {
    super(message);
    this.name = "DiscoveryProviderError";
    this.code = code;
  }
}
