import assert from "node:assert/strict";
import test from "node:test";
import { decodeGetEvidenceResponse, encodeGetEvidenceRequest, summarizeEvidence } from "../src/tapp.ts";

test("encodes GetEvidence request using current Tapp protobuf field numbers", () => {
  const encoded = encodeGetEvidenceRequest("app", Uint8Array.from([1, 2]));
  assert.equal(Buffer.from(encoded).toString("hex"), "0a0361707012020102");
});

test("rejects Tapp evidence challenges above 64 bytes", () => {
  assert.throws(() => encodeGetEvidenceRequest("app", new Uint8Array(65)), /at most 64 bytes/);
});

test("decodes GetEvidence response fields", () => {
  const response = Uint8Array.from([
    0x08, 0x01,
    0x12, 0x02, 0x6f, 0x6b,
    0x1a, 0x02, 0xaa, 0xbb,
    0x22, 0x03, 0x54, 0x44, 0x58,
    0x28, 0x7b,
  ]);
  const decoded = decodeGetEvidenceResponse(response);
  assert.equal(decoded.success, true);
  assert.equal(decoded.message, "ok");
  assert.equal(Buffer.from(decoded.evidence).toString("hex"), "aabb");
  assert.equal(decoded.teeType, "TDX");
  assert.equal(decoded.timestamp, 123n);
});

test("summarizes challenge binding from runtime_data without claiming computation", () => {
  const challenge = Buffer.from("9978d500ee45216cb6c93b886857100ce95b63f6135dd339ace7ff533d9aa154", "hex");
  const runtime = JSON.stringify({ nonce: `0x${challenge.toString("hex")}`, signer: "0x1234" });
  const evidence = Buffer.from(JSON.stringify({ quote: "0xdead", runtime_data: runtime }));
  const summary = summarizeEvidence({ success: true, message: "ok", evidence, teeType: "TDX", timestamp: 123n }, challenge);
  assert.equal(summary.challengeMatchesRuntimeData, true);
  assert.deepEqual(summary.evidenceJsonKeys, ["quote", "runtime_data"]);
  assert.equal(summary.runtimeData?.signer, "0x1234");
});
