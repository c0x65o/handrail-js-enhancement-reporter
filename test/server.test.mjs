import assert from "node:assert/strict";
import test from "node:test";

import { createSameOriginEnhancementReporterHandler } from "../dist/server.js";

function setup(session = "session-1") {
  const calls = [];
  const client = {
    discover: async () => ({ contract_version: "v1", policy: { delivery_ceiling: "work_request" } }),
    list: async (input) => { calls.push(["list", input]); return { contract_version: "v1", requests: [], pagination: { limit: 20, offset: 0, total: 0, has_more: false } }; },
    lookup: async ({ request_id }) => ({ id: request_id, status: "needs_attention", terminal: false }),
    releaseStatus: async ({ request_id }) => ({ contract_version: "v1", bridge_request_id: request_id }),
    cancel: async ({ request_id }) => ({ id: request_id, status: "cancelled", terminal: true }),
    submit: async (input) => { calls.push(["submit", input]); return { request: { id: "bridge-1", status: "needs_attention", terminal: false, linked_work_request: { id: "wr-1" } }, replayed: false }; },
    downloadAttachment: async () => ({ data: Uint8Array.from([1, 2, 3]), filename: "screen.png", mime_type: "image/png", size_bytes: 3 }),
  };
  const resolved = [];
  const handler = createSameOriginEnhancementReporterHandler({
    apiUrl: "https://handrail.example/api/assistant-change-bridge/v1",
    projectId: "project-1",
    capabilityId: "capability-1",
    token: "secret",
    resolveApplicationSessionToken: async (request) => { resolved.push(request.url); return session; },
    createClient: (token) => { assert.equal(token, session); return client; },
  });
  return { handler, calls, resolved };
}

test("handler requires an authenticated Known User session", async () => {
  const { handler } = setup("");
  const response = await handler(new Request("https://app.example/api/handrail-enhancements"));
  assert.equal(response.status, 401);
  assert.equal((await response.json()).code, "enhancement_user_authentication_required");
});

test("handler overwrites raw execution fields and forwards only enhancement checkbox requests", async () => {
  const { handler, calls } = setup();
  const response = await handler(new Request("https://app.example/api/handrail-enhancements", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://app.example" },
    body: JSON.stringify({
      idempotency_key: "intent-1",
      external_conversation_id: "conversation-1",
      title: "Saved views",
      description: "Let me save filters.",
      requested_delivery_ceiling: "production",
      auto_deploy_env: "production",
      run_codex: true,
      automation_requests: { run_work_request: true, deploy_staging: true, unexpected: true },
      attachments: [],
    }),
  }));
  assert.equal(response.status, 201);
  const payload = calls[0][1];
  assert.equal(payload.submission_kind, "enhancement");
  assert.equal(payload.source, "web_enhancement_reporter");
  assert.equal(payload.requested_delivery_ceiling, "work_request");
  assert.equal(payload.run_codex, false);
  assert.equal(payload.auto_deploy_env, null);
  assert.deepEqual(payload.automation_requests, { run_work_request: true, deploy_staging: true, deploy_production: false });
  assert.equal(payload.reporter_sdk.package, "@handrail/enhancement-reporter");
});

test("history and image downloads remain on the authenticated same-origin route", async () => {
  const { handler, calls } = setup();
  const list = await handler(new Request("https://app.example/api/handrail-enhancements?limit=10"));
  assert.equal(list.status, 200);
  assert.deepEqual(calls[0], ["list", { submission_kind: "enhancement", limit: "10", offset: undefined }]);
  const image = await handler(new Request("https://app.example/api/handrail-enhancements/requests/bridge-1/attachments/image-1"));
  assert.equal(image.status, 200);
  assert.equal(image.headers.get("content-type"), "image/png");
  assert.deepEqual([...new Uint8Array(await image.arrayBuffer())], [1, 2, 3]);
});

test("cross-site submissions are rejected before session resolution", async () => {
  const { handler, resolved } = setup();
  const response = await handler(new Request("https://app.example/api/handrail-enhancements", { headers: { origin: "https://evil.example" } }));
  assert.equal(response.status, 403);
  assert.equal(resolved.length, 0);
});
