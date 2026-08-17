import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { decodeGetEvidenceResponse, encodeGetEvidenceRequest, extractTdxReportData, summarizeEvidence } from "../src/tapp.ts";

test("encodes GetEvidence request using current Tapp protobuf field numbers", () => {
  const encoded = encodeGetEvidenceRequest("app", Uint8Array.from([1, 2]));
  assert.equal(Buffer.from(encoded).toString("hex"), "0a0361707012020102");
});

test("rejects Tapp evidence challenges above 64 bytes", () => {
  assert.throws(() => encodeGetEvidenceRequest("app", new Uint8Array(65)), /at most 64 bytes/);
});

test("decodes GetEvidence response fields", () => {
  const response = Uint8Array.from([0x08, 0x01, 0x12, 0x02, 0x6f, 0x6b, 0x1a, 0x02, 0xaa, 0xbb, 0x22, 0x03, 0x54, 0x44, 0x58, 0x28, 0x7b]);
  const decoded = decodeGetEvidenceResponse(response);
  assert.equal(decoded.success, true);
  assert.equal(decoded.message, "ok");
  assert.equal(Buffer.from(decoded.evidence).toString("hex"), "aabb");
  assert.equal(decoded.teeType, "TDX");
  assert.equal(decoded.timestamp, 123n);
});

test("extracts TDX report_data from the quote report body", () => {
  const quote = Buffer.alloc(632);
  quote.writeUInt16LE(4, 0);
  Buffer.alloc(64, 0xab).copy(quote, 568);
  const extracted = extractTdxReportData(quote);
  assert.equal(extracted?.version, 4);
  assert.equal(extracted?.reportData.toString("hex"), "ab".repeat(64));
});

test("summarizes explicit runtime_data challenge binding", () => {
  const challenge = Buffer.from("9978d500ee45216cb6c93b886857100ce95b63f6135dd339ace7ff533d9aa154", "hex");
  const runtime = JSON.stringify({ nonce: `0x${challenge.toString("hex")}`, signer: "0x1234" });
  const evidence = Buffer.from(JSON.stringify({ quote: "0xdead", runtime_data: runtime }));
  const summary = summarizeEvidence({ success: true, message: "ok", evidence, teeType: "TDX", timestamp: 123n }, challenge);
  assert.equal(summary.challengeBindingProven, true);
  assert.equal(summary.challengeMatchesRuntimeData, true);
});

test("proves current Tapp SHA-512 runtime_data binding directly from TDX report_data", () => {
  const challenge = Buffer.from("9978d500ee45216cb6c93b886857100ce95b63f6135dd339ace7ff533d9aa154", "hex");
  const signer = "0xa19C4E672576E186AF81548E950Bf74A736220C3";
  const challengeHex = `0x${challenge.toString("hex")}`;
  const runtime = JSON.stringify({ nonce: challengeHex, signer: signer.toLowerCase() });
  const reportData = createHash("sha512").update(runtime).digest();
  const quote = Buffer.alloc(632);
  quote.writeUInt16LE(4, 0);
  reportData.copy(quote, 568);
  const evidence = Buffer.from(JSON.stringify({ quote: `0x${quote.toString("hex")}`, cc_eventlog: [] }));
  const summary = summarizeEvidence({ success: true, message: "ok", evidence, teeType: "Tdx", timestamp: 123n }, challenge, signer);
  assert.equal(summary.runtimeData, null);
  assert.equal(summary.quoteMatchesExpectedRuntimeDataSha512, true);
  assert.equal(summary.challengeBindingProven, true);
  assert.equal(summary.quoteReportDataHex, `0x${reportData.toString("hex")}`);
});
