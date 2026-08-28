import assert from "node:assert/strict";
import test from "node:test";

import {
  EnhancementReporterError,
  createEnhancementReporter,
  enhancementReleaseSummary,
  normalizeEnhancementImages,
} from "../dist/index.js";

const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

test("browser submissions are same-origin policy requests with uploaded and pasted images", async () => {
  const calls = [];
  const reporter = createEnhancementReporter({
    endpoint: "/api/handrail-enhancements",
    conversationId: "conversation-1",
    appVersion: "1.2.3",
    fetch: async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ request: { id: "enhancement-1", title: "Saved views", status: "received", terminal: false, linked_work_request: null }, replayed: false }), { status: 201 });
    },
  });
  assert.equal(reporter.appVersion, "1.2.3");
  const result = await reporter.submit({
    title: "Saved views",
    description: "Let me save these filters.",
    idempotencyKey: "intent-1",
    images: [
      { data: new Blob([png], { type: "image/png" }), filename: "upload.png", source: "upload" },
      { data: `data:image/png;base64,${Buffer.from(png).toString("base64")}`, filename: "paste.png", source: "clipboard" },
    ],
  });
  assert.equal(result.request.id, "enhancement-1");
  assert.equal(calls[0].url, "/api/handrail-enhancements");
  assert.equal(calls[0].init.credentials, "same-origin");
  const payload = JSON.parse(calls[0].init.body);
  assert.equal(payload.external_conversation_id, "conversation-1");
  assert.equal(payload.idempotency_key, "intent-1");
  assert.equal(payload.context.app_version, "1.2.3");
  assert.deepEqual(payload.attachments.map((item) => item.source), ["upload", "clipboard"]);
  assert.equal(payload.reporter_sdk.package, "@handrail/enhancement-reporter");
  assert.equal("automation_requests" in payload, false);
  assert.equal("token" in payload, false);
});

test("notification opt-in follows an accepted enhancement as a separate same-origin request", async () => {
  const calls = [];
  const reporter = createEnhancementReporter({
    endpoint: "/api/handrail-enhancements",
    fetch: async (url, init) => {
      calls.push({ url, init });
      return String(url).includes("/subscription")
        ? new Response(JSON.stringify({
            notification_subscription: {
              active: true,
              created: true,
              recipient_hint: "r***@example.com",
              subscribed_at: "2026-08-25T12:00:00.000Z",
            },
          }), { status: 201 })
        : new Response(JSON.stringify({
            request: {
              id: "enhancement-notify-1",
              title: "Saved views",
              status: "needs_attention",
              terminal: false,
            },
            replayed: false,
          }), { status: 201 });
    },
  });
  const result = await reporter.submit({
    title: "Saved views",
    description: "Let me save these filters.",
    notification: {
      notifyOnResolution: true,
    },
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, "/api/handrail-enhancements");
  assert.equal(
    calls[1].url,
    "/api/handrail-enhancements/requests/enhancement-notify-1/subscription",
  );
  assert.equal(JSON.parse(calls[0].init.body).reporter_notification, undefined);
  assert.deepEqual(JSON.parse(calls[1].init.body), {
    reporter_notification: {
      notify_on_resolution: true,
      consent_version: "v1",
    },
  });
  assert.equal(result.notification_subscription.active, true);
  assert.equal(result.notification_warning, null);
});

test("notification failure does not turn an accepted enhancement into a failure", async () => {
  const reporter = createEnhancementReporter({
    fetch: async (url) => String(url).includes("/subscription")
      ? new Response("unavailable", { status: 503 })
      : new Response(JSON.stringify({
          request: {
            id: "enhancement-notify-2",
            title: "Saved views",
            status: "needs_attention",
            terminal: false,
          },
          replayed: false,
        }), { status: 201 }),
  });
  const result = await reporter.submit({
    title: "Saved views",
    description: "Let me save these filters.",
    notification: {
      notifyOnResolution: true,
    },
  });
  assert.equal(result.request.id, "enhancement-notify-2");
  assert.equal(result.notification_subscription, null);
  assert.match(result.notification_warning, /enhancement was sent/u);
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

test("history release summaries prefer production and report the change version", () => {
  const production = enhancementReleaseSummary({
    release_tracking: {
      auto_commit: { commits: [{ version: "1.4.0", commit_sha: "abc" }] },
      environments: [
        { environment: "staging", deployment_state: "fully_deployed", targets: [{ contains_change: true, current_version: "1.4.0" }] },
        { environment: "production", deployment_state: "fully_deployed", targets: [{ contains_change: true, current_version: "1.4.0" }] },
      ],
    },
  });
  assert.deepEqual(production, {
    state: "deployed",
    label: "Production deployed · v1.4.0",
    environment: "production",
    version: "v1.4.0",
  });
  assert.equal(enhancementReleaseSummary({
    release_tracking: { auto_commit: { commits: [{ version: "1.5.0" }] }, environments: [] },
  }).label, "Deployment status unavailable · v1.5.0");
  assert.deepEqual(enhancementReleaseSummary({
    release_tracking: {
      auto_commit: { commits: [{ version: "1.5.0" }] },
      environments: [{ environment: "production", deployment_state: "unknown", targets: [] }],
    },
  }), {
    state: "unknown",
    label: "Deployment status unavailable · v1.5.0",
    environment: null,
    version: "v1.5.0",
  });
  assert.equal(enhancementReleaseSummary({ release_tracking: null }).label, "Deployment status unavailable");
});

test("browser dismissal stays on the same-origin reporter endpoint", async () => {
  const calls = [];
  const reporter = createEnhancementReporter({
    fetch: async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({
        contract_version: "v1",
        request_id: "request-1",
        dismissed: true,
        dismissed_at: "2026-08-13T20:00:00.000Z",
        underlying_request_preserved: true,
      }));
    },
  });
  assert.equal((await reporter.dismiss("request-1")).underlying_request_preserved, true);
  assert.equal(calls[0].url, "/api/handrail-enhancements/requests/request-1/dismiss");
  assert.equal(calls[0].init.method, "POST");
});

test("headless history exposes UI counts, filters, restore, and bulk succeeded dismissal", async () => {
  const calls = [];
  const reporter = createEnhancementReporter({
    fetch: async (url, init) => {
      calls.push({ url, init });
      if (String(url).includes("dismiss-succeeded")) {
        return new Response(JSON.stringify({
          contract_version: "v1",
          dismissed_count: 2,
          underlying_requests_preserved: true,
        }));
      }
      if (init?.method === "DELETE") {
        return new Response(JSON.stringify({
          contract_version: "v1",
          request_id: "request-1",
          dismissed: false,
          dismissed_at: null,
          underlying_request_preserved: true,
        }));
      }
      return new Response(JSON.stringify({
        contract_version: "v1",
        requests: [],
        summary: {
          total: 7,
          needs_attention: 1,
          in_progress: 2,
          succeeded: 3,
          closed: 1,
        },
        query: {
          search: "calendar",
          statusGroup: "succeeded",
          sort: "oldest",
          visibility: "dismissed",
        },
        pagination: { limit: 9, offset: 0, total: 3, has_more: false },
      }));
    },
  });

  const page = await reporter.list({
    limit: 9,
    search: "calendar",
    statusGroup: "succeeded",
    sort: "oldest",
    visibility: "dismissed",
  });
  assert.equal(page.summary.total, 7);
  assert.equal(page.summary.succeeded, 3);
  assert.match(calls[0].url, /search=calendar/u);
  assert.match(calls[0].url, /status_group=succeeded/u);
  assert.match(calls[0].url, /sort=oldest/u);
  assert.match(calls[0].url, /visibility=dismissed/u);

  assert.equal((await reporter.restore("request-1")).dismissed, false);
  assert.equal(calls[1].init.method, "DELETE");
  assert.equal((await reporter.dismissSucceeded()).dismissed_count, 2);
  assert.equal(calls[2].url, "/api/handrail-enhancements/requests/dismiss-succeeded");
  assert.equal(calls[2].init.method, "POST");
});
