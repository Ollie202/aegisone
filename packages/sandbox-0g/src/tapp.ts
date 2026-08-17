import { createHash } from "node:crypto";
import http2 from "node:http2";

export interface TappEvidenceResponse {
  success: boolean;
  message: string;
  evidence: Uint8Array;
  teeType: string;
  timestamp: bigint;
}

export interface EvidenceSummary {
  teeType: string;
  timestamp: string;
  evidenceBytes: number;
  evidenceSha256: string;
  runtimeDataRaw: string | null;
  runtimeData: Record<string, unknown> | null;
  challengeHex: string;
  challengeMatchesRuntimeData: boolean;
  evidenceJsonKeys: string[];
}

function encodeVarint(value: number | bigint): Uint8Array {
  let current = BigInt(value);
  if (current < 0n) throw new TypeError("protobuf varint must be non-negative");
  const out: number[] = [];
  do {
    let byte = Number(current & 0x7fn);
    current >>= 7n;
    if (current) byte |= 0x80;
    out.push(byte);
  } while (current);
  return Uint8Array.from(out);
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function fieldBytes(field: number, bytes: Uint8Array): Uint8Array {
  return concat(encodeVarint((field << 3) | 2), encodeVarint(bytes.length), bytes);
}

function fieldString(field: number, value: string): Uint8Array {
  return fieldBytes(field, new TextEncoder().encode(value));
}

export function encodeGetEvidenceRequest(appId: string, nonce: Uint8Array): Uint8Array {
  if (!appId) throw new TypeError("appId is required");
  if (nonce.length > 64) throw new TypeError("Tapp evidence nonce must be at most 64 bytes");
  return concat(fieldString(1, appId), ...(nonce.length ? [fieldBytes(2, nonce)] : []));
}

function readVarint(bytes: Uint8Array, start: number): { value: bigint; next: number } {
  let value = 0n;
  let shift = 0n;
  let offset = start;
  while (offset < bytes.length) {
    const byte = bytes[offset++];
    value |= BigInt(byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) return { value, next: offset };
    shift += 7n;
    if (shift > 70n) throw new Error("protobuf varint is too large");
  }
  throw new Error("truncated protobuf varint");
}

function readLengthDelimited(bytes: Uint8Array, start: number): { value: Uint8Array; next: number } {
  const length = readVarint(bytes, start);
  const size = Number(length.value);
  if (!Number.isSafeInteger(size)) throw new Error("protobuf field is too large");
  const end = length.next + size;
  if (end > bytes.length) throw new Error("truncated protobuf field");
  return { value: bytes.slice(length.next, end), next: end };
}

export function decodeGetEvidenceResponse(bytes: Uint8Array): TappEvidenceResponse {
  const out: TappEvidenceResponse = { success: false, message: "", evidence: new Uint8Array(), teeType: "", timestamp: 0n };
  let offset = 0;
  while (offset < bytes.length) {
    const tag = readVarint(bytes, offset);
    offset = tag.next;
    const field = Number(tag.value >> 3n);
    const wire = Number(tag.value & 7n);
    if (wire === 0) {
      const value = readVarint(bytes, offset);
      offset = value.next;
      if (field === 1) out.success = value.value !== 0n;
      else if (field === 5) out.timestamp = value.value;
      continue;
    }
    if (wire === 2) {
      const value = readLengthDelimited(bytes, offset);
      offset = value.next;
      if (field === 2) out.message = new TextDecoder().decode(value.value);
      else if (field === 3) out.evidence = value.value;
      else if (field === 4) out.teeType = new TextDecoder().decode(value.value);
      continue;
    }
    throw new Error(`unsupported protobuf wire type ${wire} for field ${field}`);
  }
  return out;
}

function grpcFrame(message: Uint8Array): Uint8Array {
  const header = new Uint8Array(5);
  const view = new DataView(header.buffer);
  header[0] = 0;
  view.setUint32(1, message.length, false);
  return concat(header, message);
}

function decodeGrpcFrame(bytes: Uint8Array): Uint8Array {
  if (bytes.length < 5) throw new Error("truncated gRPC frame");
  if (bytes[0] !== 0) throw new Error("compressed gRPC frames are not supported");
  const length = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(1, false);
  if (bytes.length < 5 + length) throw new Error("truncated gRPC message");
  return bytes.slice(5, 5 + length);
}

export async function getEvidence(teeUrl: string, appId: string, nonce: Uint8Array, timeoutMs = 15_000): Promise<TappEvidenceResponse> {
  const target = new URL(teeUrl);
  if (target.protocol !== "http:" && target.protocol !== "https:") throw new TypeError(`unsupported Tapp URL protocol ${target.protocol}`);
  const client = http2.connect(`${target.protocol}//${target.host}`);
  const requestBytes = grpcFrame(encodeGetEvidenceRequest(appId, nonce));
  try {
    return await new Promise<TappEvidenceResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        request.close(http2.constants.NGHTTP2_CANCEL);
        reject(new Error(`Tapp GetEvidence timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      const chunks: Buffer[] = [];
      let grpcStatus = "0";
      let grpcMessage = "";
      const request = client.request({
        ":method": "POST",
        ":path": "/tapp_service.TappService/GetEvidence",
        "content-type": "application/grpc",
        "te": "trailers",
        "grpc-accept-encoding": "identity",
      });
      request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      request.on("trailers", (headers) => {
        if (headers["grpc-status"] !== undefined) grpcStatus = String(headers["grpc-status"]);
        if (headers["grpc-message"] !== undefined) grpcMessage = String(headers["grpc-message"]);
      });
      request.on("response", (headers) => {
        if (headers["grpc-status"] !== undefined) grpcStatus = String(headers["grpc-status"]);
        if (headers["grpc-message"] !== undefined) grpcMessage = String(headers["grpc-message"]);
      });
      request.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      request.on("end", () => {
        clearTimeout(timer);
        try {
          if (grpcStatus !== "0") throw new Error(`Tapp GetEvidence gRPC ${grpcStatus}: ${decodeURIComponent(grpcMessage || "unknown error")}`);
          const body = Buffer.concat(chunks);
          const decoded = decodeGetEvidenceResponse(decodeGrpcFrame(body));
          if (!decoded.success) throw new Error(`Tapp GetEvidence failed: ${decoded.message || "unknown error"}`);
          resolve(decoded);
        } catch (error) {
          reject(error);
        }
      });
      request.end(requestBytes);
    });
  } finally {
    client.close();
  }
}

export function summarizeEvidence(response: TappEvidenceResponse, challenge: Uint8Array): EvidenceSummary {
  const evidenceBytes = Buffer.from(response.evidence);
  const challengeHex = `0x${Buffer.from(challenge).toString("hex")}`;
  let evidenceObject: Record<string, unknown> | null = null;
  let runtimeDataRaw: string | null = null;
  let runtimeData: Record<string, unknown> | null = null;
  try {
    const parsed = JSON.parse(evidenceBytes.toString("utf8"));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) evidenceObject = parsed as Record<string, unknown>;
    const runtime = evidenceObject?.runtime_data;
    if (typeof runtime === "string") {
      runtimeDataRaw = runtime;
      const parsedRuntime = JSON.parse(runtime);
      if (parsedRuntime && typeof parsedRuntime === "object" && !Array.isArray(parsedRuntime)) runtimeData = parsedRuntime as Record<string, unknown>;
    } else if (runtime && typeof runtime === "object" && !Array.isArray(runtime)) {
      runtimeData = runtime as Record<string, unknown>;
      runtimeDataRaw = JSON.stringify(runtime);
    }
  } catch {
    // Evidence remains useful as raw bytes/hash even if its envelope is not JSON.
  }
  const nonce = typeof runtimeData?.nonce === "string" ? runtimeData.nonce.toLowerCase() : "";
  return {
    teeType: response.teeType,
    timestamp: response.timestamp.toString(),
    evidenceBytes: response.evidence.length,
    evidenceSha256: createHash("sha256").update(response.evidence).digest("hex"),
    runtimeDataRaw,
    runtimeData,
    challengeHex,
    challengeMatchesRuntimeData: nonce === challengeHex.toLowerCase(),
    evidenceJsonKeys: evidenceObject ? Object.keys(evidenceObject).sort() : [],
  };
}
