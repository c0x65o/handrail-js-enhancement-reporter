import { HandrailClient } from "@handrail/mcp/client";

import { ENHANCEMENT_SOURCE, reporterIdentity } from "./identity";
import { MAX_ENHANCEMENT_IMAGES } from "./reporter";

export interface EnhancementBridgeClient {
  discover(): Promise<any>;
  submit(input: Record<string, unknown>): Promise<any>;
  list(input?: Record<string, unknown>): Promise<any>;
  lookup(input: { request_id: string }): Promise<any>;
  releaseStatus(input: { request_id: string }): Promise<any>;
  cancel(input: { request_id: string; reason?: string | null }): Promise<any>;
  downloadAttachment(input: { request_id: string; attachment_id: string }): Promise<{ data: Uint8Array; filename: string | null; mime_type: string; size_bytes: number }>;
}

function automationRequests(value: unknown): Record<string, boolean> {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return {
    run_work_request: source.run_work_request === true,
    deploy_staging: source.deploy_staging === true,
    deploy_production: source.deploy_production === true,
  };
}

export interface SameOriginEnhancementReporterConfig<RequestType extends Request = Request> {
  readonly enabled?: boolean;
  readonly routeBasePath?: string;
  readonly apiUrl: string;
  readonly projectId: string;
  readonly capabilityId: string;
  readonly token: string;
  readonly contractVersion?: "v1";
  readonly fetch?: typeof fetch;
  /** Resolve the authenticated application's opaque Known User session for every request. */
  readonly resolveApplicationSessionToken: (request: RequestType) => string | null | undefined | Promise<string | null | undefined>;
  /** Test/custom transport seam. Production integrations normally omit it. */
  readonly createClient?: (applicationSessionToken: string) => EnhancementBridgeClient;
}

const MAX_FORWARD_BODY_BYTES = 22 * 1024 * 1024;

function clean(value: unknown, max = 20_000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function routeBasePath(value: unknown): string {
  const path = clean(value || "/api/handrail-enhancements", 2_000).replace(/\/+$/u, "");
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("?") || path.includes("#")) {
    throw new Error("routeBasePath must be a same-origin absolute path");
  }
  return path;
}

function sameOriginRequest(request: Request): boolean {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}

function errorResponse(error: any): Response {
  const status = Number(error?.status || error?.statusCode) || 500;
  const safeStatus = status >= 400 && status <= 599 ? status : 500;
  return json(safeStatus, {
    error: clean(error?.message, 500) || "Enhancement request failed.",
    code: clean(error?.code, 120) || "enhancement_reporter_server_error",
  });
}

async function requestBody(request: Request): Promise<Record<string, any> | null> {
  if (!String(request.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) return null;
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_FORWARD_BODY_BYTES) throw Object.assign(new Error("Enhancement request body is too large."), { status: 413, code: "enhancement_request_too_large" });
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_FORWARD_BODY_BYTES) throw Object.assign(new Error("Enhancement request body is too large."), { status: 413, code: "enhancement_request_too_large" });
  try {
    const body = JSON.parse(text);
    return body && typeof body === "object" && !Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
}

function enhancementPayload(body: Record<string, any>): Record<string, unknown> | null {
  const title = clean(body.title, 500);
  const description = clean(body.description, 20_000);
  const idempotencyKey = clean(body.idempotency_key, 255);
  const conversationId = clean(body.external_conversation_id, 512);
  if (!title || !description || !idempotencyKey || !conversationId) return null;
  if (Array.isArray(body.attachments) && body.attachments.length > MAX_ENHANCEMENT_IMAGES) return null;
  const attachments = Array.isArray(body.attachments) ? body.attachments.map((item: any) => ({
    filename: clean(item?.filename, 200),
    data_url: clean(item?.data_url, 8 * 1024 * 1024),
    source: item?.source === "clipboard" ? "clipboard" : "upload",
  })) : [];
  const context = body.context && typeof body.context === "object" && !Array.isArray(body.context) ? body.context : {};
  return {
    idempotency_key: idempotencyKey,
    external_conversation_id: conversationId,
    requested_mode: "work_request",
    requested_delivery_ceiling: "work_request",
    submission_kind: "enhancement",
    source: ENHANCEMENT_SOURCE,
    title,
    description,
    priority: ["low", "medium", "high", "urgent"].includes(body.priority) ? body.priority : "medium",
    category: "feature",
    run_codex: false,
    ci_cd: false,
    target_check_ids: [],
    auto_commit_push: false,
    auto_deploy_env: null,
    context: {
      route: clean(context.route, 2_000) || null,
      page_title: clean(context.page_title, 500) || null,
      app_version: clean(context.app_version, 160) || null,
      viewport: clean(context.viewport, 80) || null,
    },
    reporter_sdk: reporterIdentity("node"),
    automation_requests: automationRequests(body.automation_requests),
    attachments,
  };
}

function decodePathPart(value: string): string | null {
  try { return clean(decodeURIComponent(value), 160) || null; } catch { return null; }
}

/**
 * Framework-neutral Web Request/Response handler. Mount it behind the host
 * application's authenticated session route and pass only an opaque Known User
 * session from the resolver. Cookies and application authorization headers are
 * never forwarded to Handrail.
 */
export function createSameOriginEnhancementReporterHandler<RequestType extends Request = Request>(
  config: SameOriginEnhancementReporterConfig<RequestType>,
): (request: RequestType) => Promise<Response> {
  if (typeof config.resolveApplicationSessionToken !== "function") throw new Error("resolveApplicationSessionToken is required");
  const basePath = routeBasePath(config.routeBasePath);
  const createClient = config.createClient || ((sessionToken: string) => new HandrailClient({
    enabled: true,
    apiUrl: config.apiUrl,
    contractVersion: config.contractVersion || "v1",
    projectId: config.projectId,
    capabilityId: config.capabilityId,
    token: config.token,
    sessionToken,
    fetch: config.fetch,
  }, {}) as EnhancementBridgeClient);

  return async (request: RequestType): Promise<Response> => {
    if (config.enabled === false) return json(404, { error: "Enhancement reporting is disabled.", code: "enhancement_reporting_disabled" });
    if (!sameOriginRequest(request)) return json(403, { error: "Cross-site enhancement requests are denied.", code: "enhancement_cross_site_denied" });
    let path: string;
    try { path = new URL(request.url).pathname; } catch { return json(400, { error: "Invalid request URL.", code: "enhancement_route_invalid" }); }
    if (path !== basePath && !path.startsWith(`${basePath}/`)) return json(404, { error: "Enhancement route not found.", code: "enhancement_route_not_found" });
    const relative = path.slice(basePath.length).replace(/^\//u, "");
    const parts = relative ? relative.split("/") : [];
    const sessionToken = clean(await config.resolveApplicationSessionToken(request), 8_192);
    if (!sessionToken) return json(401, { error: "An authenticated application user is required.", code: "enhancement_user_authentication_required" });
    const client = createClient(sessionToken);

    try {
      if (request.method === "GET" && parts.length === 1 && parts[0] === "policy") return json(200, await client.discover());
      if (request.method === "GET" && parts.length === 0) {
        const url = new URL(request.url);
        return json(200, await client.list({ submission_kind: "enhancement", limit: url.searchParams.get("limit") || undefined, offset: url.searchParams.get("offset") || undefined }));
      }
      if (parts[0] === "requests" && parts.length >= 2) {
        const requestId = decodePathPart(parts[1]);
        if (!requestId) return json(404, { error: "Enhancement request not found.", code: "enhancement_request_not_found" });
        if (request.method === "GET" && parts.length === 2) return json(200, await client.lookup({ request_id: requestId }));
        if (request.method === "GET" && parts.length === 3 && parts[2] === "release-status") return json(200, await client.releaseStatus({ request_id: requestId }));
        if (request.method === "GET" && parts.length === 4 && parts[2] === "attachments") {
          const attachmentId = decodePathPart(parts[3]);
          if (!attachmentId) return json(404, { error: "Enhancement image not found.", code: "enhancement_attachment_not_found" });
          const attachment = await client.downloadAttachment({ request_id: requestId, attachment_id: attachmentId });
          const safeName = clean(attachment.filename, 160).replace(/["\r\n]/gu, "") || "enhancement-image";
          return new Response(attachment.data as BodyInit, { status: 200, headers: {
            "content-type": attachment.mime_type,
            "content-length": String(attachment.size_bytes),
            "content-disposition": `inline; filename="${safeName}"`,
            "cache-control": "private, no-store",
          } });
        }
        if (request.method === "POST" && parts.length === 3 && parts[2] === "cancel") {
          const body = await requestBody(request);
          return json(200, await client.cancel({ request_id: requestId, reason: clean(body?.reason, 2_000) || null }));
        }
      }
      if (request.method === "POST" && parts.length === 0) {
        const body = await requestBody(request);
        const payload = body ? enhancementPayload(body) : null;
        if (!payload) return json(400, { error: "A valid title, description, conversation id, and idempotency key are required.", code: "enhancement_request_invalid" });
        return json(201, await client.submit(payload));
      }
      return new Response(null, { status: 405, headers: { allow: "GET, POST" } });
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export { ENHANCEMENT_SOURCE, SDK_COMMIT, SDK_NAME, SDK_RELEASE_REF, SDK_VERSION } from "./identity";
