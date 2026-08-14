import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createSameOriginEnhancementReporterHandler } from "../dist/server.js";

test("package has no MCP install or runtime dependency", async () => {
  const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const serverBundle = await readFile(new URL("../dist/server.js", import.meta.url), "utf8");
  assert.equal(manifest.dependencies?.["@handrail/mcp"], undefined);
  assert.equal(manifest.peerDependencies?.["@handrail/mcp"], undefined);
  assert.equal(manifest.devDependencies?.["@handrail/mcp"], undefined);
  assert.doesNotMatch(serverBundle, /@handrail\/mcp/u);
});

function setup(session = "session-1") {
  const calls = [];
  const client = {
    discover: async () => ({ contract_version: "v1", policy: { delivery_ceiling: "work_request" } }),
    list: async (input) => { calls.push(["list", input]); return { contract_version: "v1", requests: [], pagination: { limit: 20, offset: 0, total: 0, has_more: false } }; },
    lookup: async ({ request_id }) => ({ id: request_id, status: "needs_attention", terminal: false }),
    releaseStatus: async ({ request_id }) => ({ contract_version: "v1", bridge_request_id: request_id }),
    dismiss: async ({ request_id }) => { calls.push(["dismiss", { request_id }]); return { contract_version: "v1", request_id, dismissed_at: "2026-08-13T20:00:00.000Z", underlying_request_preserved: true }; },
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

test("default server transport stands alone without the MCP package", async () => {
  const calls = [];
  const handler = createSameOriginEnhancementReporterHandler({
    apiUrl: "https://handrail.example/api/assistant-change-bridge/v1",
    projectId: "project-1",
    capabilityId: "capability-1",
    token: "server-secret",
    resolveApplicationSessionToken: async () => "known-user-session",
    fetch: async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({
        contract_version: "v1",
        request_id: "bridge-1",
        dismissed_at: "2026-08-14T14:00:00.000Z",
        underlying_request_preserved: true,
      }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });

  const response = await handler(new Request("https://app.example/api/handrail-enhancements/requests/bridge-1/dismiss", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://app.example" },
    body: "{}",
  }));

  assert.equal(response.status, 200);
  assert.equal((await response.json()).underlying_request_preserved, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://handrail.example/api/assistant-change-bridge/v1/requests/bridge-1/dismiss");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.body, "{}");
  assert.equal(calls[0].init.headers.authorization, "Bearer server-secret");
  assert.equal(calls[0].init.headers["x-handrail-api-contract-version"], "v1");
  assert.equal(calls[0].init.headers["x-handrail-application-session"], "known-user-session");
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
  const dismissed = await handler(new Request("https://app.example/api/handrail-enhancements/requests/bridge-1/dismiss", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://app.example" },
    body: "{}",
  }));
  assert.equal(dismissed.status, 200);
  assert.equal((await dismissed.json()).underlying_request_preserved, true);
  assert.deepEqual(calls.at(-1), ["dismiss", { request_id: "bridge-1" }]);
});

test("cross-site submissions are rejected before session resolution", async () => {
  const { handler, resolved } = setup();
  const response = await handler(new Request("https://app.example/api/handrail-enhancements", { headers: { origin: "https://evil.example" } }));
  assert.equal(response.status, 403);
  assert.equal(resolved.length, 0);
});
