function normalize(value: unknown, seen: Set<object>): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Canonical JSON does not support non-finite numbers");
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) throw new TypeError("Canonical JSON does not support cycles");
    seen.add(value);
    const normalized = value.map((entry) => {
      if (entry === undefined) throw new TypeError("Canonical JSON does not support undefined");
      return normalize(entry, seen);
    });
    seen.delete(value);
    return normalized;
  }
  if (typeof value === "object") {
    if (seen.has(value)) throw new TypeError("Canonical JSON does not support cycles");
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError("Canonical JSON only supports plain objects");
    }
    seen.add(value);
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      const entry = (value as Record<string, unknown>)[key];
      if (entry === undefined) throw new TypeError(`Canonical JSON does not support undefined at ${key}`);
      output[key] = normalize(entry, seen);
    }
    seen.delete(value);
    return output;
  }
  throw new TypeError(`Canonical JSON does not support ${typeof value}`);
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalize(value, new Set()));
}

export function canonicalBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(canonicalJson(value));
}
