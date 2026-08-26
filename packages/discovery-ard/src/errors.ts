import type { ArdErrorCode } from "./types.ts";

export class ArdAdapterError extends Error {
  readonly code: ArdErrorCode;
  readonly statusCode: number;

  constructor(code: ArdErrorCode, message: string, statusCode = 400) {
    super(message);
    this.name = "ArdAdapterError";
    this.code = code;
    this.statusCode = statusCode;
  }
}
