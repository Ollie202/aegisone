import { StorageRoundTripError } from "./types.ts";

export function normalizePrivateKey(value: string): string {
  const trimmed = value.trim();
  const normalized = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new StorageRoundTripError(
      "INVALID_PRIVATE_KEY",
      "configuration",
      "ZEROG_STORAGE_PRIVATE_KEY must contain exactly 64 hexadecimal characters (with or without 0x)",
      false,
    );
  }
  return normalized;
}
