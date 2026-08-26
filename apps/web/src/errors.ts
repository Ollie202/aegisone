/**
 * Shared HTTP-shaped request error used by `product.ts` (`POST /search`, `/api/jobs`, ...) and
 * `search-service.ts` (M8.8 `proofrail_search` reuse). Kept in its own module so neither of those
 * two files needs to import the other, avoiding a circular dependency once `mcp.ts` wires them
 * together for the MCP transport.
 */
export class ProductRequestError extends Error {
  readonly code: "invalid_request" | "request_too_large";
  readonly statusCode: number;

  constructor(code: "invalid_request" | "request_too_large", message: string, statusCode = 400) {
    super(message);
    this.name = "ProductRequestError";
    this.code = code;
    this.statusCode = statusCode;
  }
}
