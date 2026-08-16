import { StorageRoundTripError } from "./types.ts";

export function normalizePrivateKey(value: string): string {
  let trimmed = value.trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    trimmed = trimmed.slice(1, -1).trim();
  }
  const assignmentPrefix = "ZEROG_STORAGE_PRIVATE_KEY=";
  if (trimmed.startsWith(assignmentPrefix)) {
    trimmed = trimmed.slice(assignmentPrefix.length).trim();
  }
  const normalized = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
    const wordCount = trimmed.split(/\s+/u).filter(Boolean).length;
    const diagnosis = /^(?:0x)?[0-9a-fA-F]{40}$/.test(trimmed)
      ? "the value looks like a public wallet address, not a private key"
      : wordCount === 12 || wordCount === 24
        ? "the value looks like a recovery phrase, not an account private key"
        : `${trimmed.length} characters were received; the value must be exactly 64 hexadecimal characters`;
    throw new StorageRoundTripError(
      "INVALID_PRIVATE_KEY",
      "configuration",
      `Invalid ZEROG_STORAGE_PRIVATE_KEY: ${diagnosis} (with or without 0x)`,
      false,
    );
  }
  return normalized;
}
