import assert from "node:assert/strict";
import test from "node:test";

import {
  EnhancementReporterError,
  createEnhancementReporter,
  normalizeEnhancementImages,
} from "../dist/index.js";

const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

test("browser submissions are same-origin, pending-only payloads with uploaded and pasted images", async () => {
  const calls = [];
  const reporter = createEnhancementReporter({
    endpoint: "/api/handrail-enhancements",
    conversationId: "conversation-1",
    appVersion: "1.2.3",
    fetch: async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ request: { id: "bridge-1", title: "Saved views", status: "needs_attention", terminal: false, linked_work_request: { id: "wr-1" } }, replayed: false }), { status: 201 });
    },
  });
  const result = await reporter.submit({
    title: "Saved views",
    description: "Let me save these filters.",
    idempotencyKey: "intent-1",
    images: [
      { data: new Blob([png], { type: "image/png" }), filename: "upload.png", source: "upload" },
      { data: `data:image/png;base64,${Buffer.from(png).toString("base64")}`, filename: "paste.png", source: "clipboard" },
    ],
  });
  assert.equal(result.request.linked_work_request.id, "wr-1");
  assert.equal(calls[0].url, "/api/handrail-enhancements");
  assert.equal(calls[0].init.credentials, "same-origin");
  const payload = JSON.parse(calls[0].init.body);
  assert.equal(payload.external_conversation_id, "conversation-1");
  assert.equal(payload.idempotency_key, "intent-1");
  assert.equal(payload.context.app_version, "1.2.3");
  assert.deepEqual(payload.attachments.map((item) => item.source), ["upload", "clipboard"]);
  assert.equal(payload.reporter_sdk.package, "@handrail/enhancement-reporter");
  assert.equal("token" in payload, false);
});

test("image normalization validates types, signatures, and count", async () => {
  const normalized = await normalizeEnhancementImages([{ data: png.buffer, mimeType: "image/png", source: "clipboard" }]);
  assert.equal(normalized[0].size_bytes, png.byteLength);
  assert.equal(normalized[0].source, "clipboard");
  await assert.rejects(normalizeEnhancementImages([{ data: new Uint8Array([1, 2, 3]).buffer, mimeType: "image/png" }]), EnhancementReporterError);
  await assert.rejects(normalizeEnhancementImages(Array.from({ length: 5 }, () => ({ data: png.buffer, mimeType: "image/png" }))), { code: "image_count_exceeded" });
});

test("absolute and cross-origin browser endpoints are rejected", () => {
  assert.throws(() => createEnhancementReporter({ endpoint: "https://handrail.example/api" }), { code: "invalid_configuration" });
  assert.throws(() => createEnhancementReporter({ endpoint: "//handrail.example/api" }), { code: "invalid_configuration" });
});
