import { ENHANCEMENT_SOURCE, reporterIdentity } from "./identity";

export const MAX_ENHANCEMENT_IMAGES = 4;
export const MAX_ENHANCEMENT_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_ENHANCEMENT_IMAGE_TOTAL_BYTES = 15 * 1024 * 1024;
export const ENHANCEMENT_IMAGE_TYPES = Object.freeze([
  "image/png", "image/jpeg", "image/gif", "image/webp",
] as const);

export type EnhancementImageMimeType = (typeof ENHANCEMENT_IMAGE_TYPES)[number];
export type EnhancementImageSource = "upload" | "clipboard";

export interface EnhancementImageInput {
  readonly data: string | Blob | ArrayBuffer | ArrayBufferView;
  readonly filename?: string;
  readonly mimeType?: EnhancementImageMimeType | "image/jpg";
  readonly source?: EnhancementImageSource;
}

export interface NormalizedEnhancementImage {
  readonly filename: string;
  readonly data_url: string;
  readonly mime_type: EnhancementImageMimeType;
  readonly size_bytes: number;
  readonly source: EnhancementImageSource;
}

export interface EnhancementRequestInput {
  readonly title: string;
  readonly description: string;
  readonly priority?: "low" | "medium" | "high" | "urgent";
  readonly images?: readonly EnhancementImageInput[];
  readonly context?: {
    readonly route?: string;
    readonly pageTitle?: string;
    readonly appVersion?: string;
    readonly viewport?: string;
  };
  readonly idempotencyKey?: string;
  readonly conversationId?: string;
  /** Customer choices rendered only for actions whose current policy is Ask. */
  readonly automationRequests?: {
    readonly run_work_request?: boolean;
    readonly deploy_staging?: boolean;
    readonly deploy_production?: boolean;
  };
  /** Explicit report-scoped consent for one email after the fix reaches the report environment. */
  readonly notification?: EnhancementNotificationPreference;
}

export interface EnhancementNotificationPreference {
  readonly notifyOnResolution: true;
  readonly consentVersion?: "v1" | string;
  /** @deprecated The server derives the recipient from the verified Known User identity. */
  readonly email?: string;
}

export interface EnhancementNotificationSubscription {
  readonly active: boolean;
  readonly created: boolean;
  readonly recipient_hint: string | null;
  readonly subscribed_at: string | null;
}

export interface EnhancementSubmissionResult {
  readonly request: EnhancementRequestRecord;
  readonly replayed: boolean;
  readonly notification_subscription?: EnhancementNotificationSubscription | null;
  readonly notification_warning?: string | null;
}

export interface EnhancementReporterConfig {
  /** Same-origin absolute path. Defaults to `/api/handrail-enhancements`. */
  readonly endpoint?: string;
  readonly enabled?: boolean;
  readonly appVersion?: string;
  readonly conversationId?: string;
  /** @deprecated Notification recipients are derived from Known Users. */
  readonly reporterEmail?: string;
  /** Set false to hide notification opt-in controls in the packaged dialog. */
  readonly notificationsEnabled?: boolean;
  readonly fetch?: typeof fetch;
}

export const ENHANCEMENT_HISTORY_STATUS_GROUPS = Object.freeze([
  "needs_attention",
  "in_progress",
  "succeeded",
  "closed",
] as const);
export const ENHANCEMENT_HISTORY_SORTS = Object.freeze(["newest", "oldest"] as const);
export const ENHANCEMENT_HISTORY_VISIBILITIES = Object.freeze(["active", "dismissed", "all"] as const);

export type EnhancementHistoryStatusGroup = (typeof ENHANCEMENT_HISTORY_STATUS_GROUPS)[number];
export type EnhancementHistorySort = (typeof ENHANCEMENT_HISTORY_SORTS)[number];
export type EnhancementHistoryVisibility = (typeof ENHANCEMENT_HISTORY_VISIBILITIES)[number];

export interface EnhancementHistoryCapabilities {
  /** True when this verified principal may use owned history. Added independently of automation access. */
  readonly enabled?: boolean;
  readonly summary: boolean;
  readonly search: boolean;
  readonly status_groups: readonly EnhancementHistoryStatusGroup[];
  readonly sorts: readonly EnhancementHistorySort[];
  readonly visibilities: readonly EnhancementHistoryVisibility[];
  readonly restore: boolean;
  readonly dismiss_succeeded: boolean;
}

export interface EnhancementReporterDiscovery {
  readonly contract_version?: "v1";
  readonly enhancement_reporting?: {
    readonly enabled?: boolean;
    readonly user_enabled?: boolean;
    readonly access_level?: string | null;
    readonly history?: EnhancementHistoryCapabilities;
    readonly policy?: unknown;
  };
  readonly reporter_notifications?: {
    readonly available?: boolean;
    readonly recipient_hint?: string | null;
    /** New Handrail servers advertise only fixed; deployed remains accepted for older servers. */
    readonly lifecycles?: readonly ("fixed" | "deployed")[];
  };
  readonly operations?: readonly string[];
  readonly [key: string]: unknown;
}

export interface EnhancementRequestRecord {
  readonly id: string;
  readonly title: string;
  readonly description?: string | null;
  readonly status: string;
  readonly status_group: EnhancementHistoryStatusGroup;
  readonly terminal: boolean;
  readonly submission_kind?: "enhancement";
  readonly linked_work_request?: { readonly id: string } | null;
  readonly attachments?: readonly {
    readonly id: string;
    readonly filename: string;
    readonly mime_type: string;
    readonly size_bytes: number;
    readonly download_path: string;
  }[];
  readonly release_tracking?: EnhancementReleaseTracking | null;
  readonly dismissed_at: string | null;
  readonly dismissed: boolean;
  readonly created_at?: string;
  readonly updated_at?: string;
  readonly [key: string]: unknown;
}

export interface EnhancementReleaseTarget {
  readonly current_version?: string | null;
  readonly change_version?: string | null;
  readonly contains_change?: boolean | null;
  readonly containment_basis?: string | null;
}

export interface EnhancementReleaseEnvironment {
  readonly environment: string;
  readonly deployment_state: "fully_deployed" | "partially_deployed" | "not_deployed" | "unknown" | "no_targets" | string;
  readonly targets?: readonly EnhancementReleaseTarget[];
}

export interface EnhancementReleaseTracking {
  readonly auto_commit?: {
    readonly commits?: readonly { readonly version?: string | null; readonly commit_sha?: string | null }[];
  };
  readonly environments?: readonly EnhancementReleaseEnvironment[];
}

export interface EnhancementReleaseSummary {
  readonly state: "deployed" | "partially_deployed" | "not_deployed" | "unknown";
  readonly label: string;
  readonly environment: string | null;
  readonly version: string | null;
}

export interface EnhancementRequestPage {
  readonly contract_version: "v1";
  readonly requests: readonly EnhancementRequestRecord[];
  readonly summary: EnhancementHistorySummary | null;
  readonly query: EnhancementHistoryQuery | null;
  readonly pagination: { readonly limit: number; readonly offset: number; readonly total: number; readonly has_more: boolean };
}

export interface EnhancementHistorySummary {
  readonly total: number;
  readonly needs_attention: number;
  readonly in_progress: number;
  readonly succeeded: number;
  readonly closed: number;
}

export interface EnhancementHistoryQuery {
  readonly search: string;
  readonly statusGroup: EnhancementHistoryStatusGroup | null;
  readonly sort: EnhancementHistorySort;
  readonly visibility: EnhancementHistoryVisibility;
}

export interface EnhancementHistoryListOptions {
  readonly limit?: number;
  readonly offset?: number;
  readonly search?: string;
  readonly statusGroup?: EnhancementHistoryStatusGroup;
  readonly sort?: EnhancementHistorySort;
  readonly visibility?: EnhancementHistoryVisibility;
}

export interface EnhancementDismissResult {
  readonly contract_version: "v1";
  readonly request_id: string;
  readonly dismissed: true;
  readonly dismissed_at: string;
  readonly underlying_request_preserved: true;
}

export interface EnhancementRestoreResult {
  readonly contract_version: "v1";
  readonly request_id: string;
  readonly dismissed: false;
  readonly dismissed_at: null;
  readonly underlying_request_preserved: true;
}

export interface EnhancementDismissSucceededResult {
  readonly contract_version: "v1";
  readonly dismissed_count: number;
  readonly underlying_requests_preserved: true;
}

export class EnhancementReporterError extends Error {
  readonly code: string;
  readonly statusCode: number | null;

  constructor(code: string, message: string, statusCode: number | null = null) {
    super(message);
    this.name = "EnhancementReporterError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

function clean(value: unknown, max = 20_000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function record(value: unknown): Record<string, any> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, any>
    : null;
}

function displayVersion(value: unknown): string | null {
  const version = clean(value, 160);
  if (!version) return null;
  return version.startsWith("v") ? version : `v${version}`;
}

export function enhancementReleaseSummary(request: Pick<EnhancementRequestRecord, "release_tracking">): EnhancementReleaseSummary {
  const tracking = record(request.release_tracking);
  const environments = Array.isArray(tracking?.environments)
    ? tracking.environments.map(record).filter(Boolean) as Record<string, any>[]
    : [];
  const environmentPriority = new Map([["production", 0], ["staging", 1], ["dev", 2]]);
  const deployed = environments
    .filter((environment) => ["fully_deployed", "partially_deployed"].includes(clean(environment.deployment_state, 80)))
    .sort((left, right) => (
      (environmentPriority.get(clean(left.environment, 80).toLowerCase()) ?? 10)
      - (environmentPriority.get(clean(right.environment, 80).toLowerCase()) ?? 10)
    ))[0];
  if (deployed) {
    const environment = clean(deployed.environment, 80).toLowerCase() || "environment";
    const targets = Array.isArray(deployed.targets)
      ? deployed.targets.map(record).filter(Boolean) as Record<string, any>[]
      : [];
    const versions = [...new Set(targets
      .filter((target) => target.contains_change === true)
      .map((target) => displayVersion(target.current_version || target.change_version))
      .filter(Boolean))];
    const version = versions.length === 1 ? versions[0] : null;
    const partial = deployed.deployment_state === "partially_deployed";
    const environmentLabel = `${environment.charAt(0).toUpperCase()}${environment.slice(1)}`;
    return Object.freeze({
      state: partial ? "partially_deployed" : "deployed",
      label: `${environmentLabel} ${partial ? "partially deployed" : "deployed"}${version ? ` · ${version}` : versions.length > 1 ? " · multiple versions" : ""}`,
      environment,
      version,
    });
  }
  const autoCommit = record(tracking?.auto_commit);
  const commits = Array.isArray(autoCommit?.commits)
    ? autoCommit.commits.map(record).filter(Boolean) as Record<string, any>[]
    : [];
  const versions = [...new Set(commits.map((commit) => displayVersion(commit.version)).filter(Boolean))];
  const version = versions.length === 1 ? versions[0] : null;
  const deploymentStates = environments.map((environment) => clean(environment.deployment_state, 80));
  const statusUnknown = !tracking
    || deploymentStates.length === 0
    || deploymentStates.includes("unknown")
    || (deploymentStates.length > 0 && deploymentStates.every((state) => state === "no_targets"));
  if (statusUnknown) {
    return Object.freeze({
      state: "unknown",
      label: `Deployment status unavailable${version ? ` · ${version}` : versions.length > 1 ? " · multiple versions" : ""}`,
      environment: null,
      version,
    });
  }
  return Object.freeze({
    state: "not_deployed",
    label: `Not deployed${version ? ` · ${version}` : versions.length > 1 ? " · multiple versions" : ""}`,
    environment: null,
    version,
  });
}

function endpointPath(value: unknown): string {
  const path = clean(value || "/api/handrail-enhancements", 2_000).replace(/\/+$/u, "");
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("?") || path.includes("#")) {
    throw new EnhancementReporterError("invalid_configuration", "The enhancement reporter endpoint must be a same-origin absolute path.");
  }
  return path || "/api/handrail-enhancements";
}

function randomId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  if (typeof globalThis.crypto?.getRandomValues !== "function") {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function normalizedMimeType(value: unknown): EnhancementImageMimeType | null {
  const mime = clean(value, 120).toLowerCase();
  const normalized = mime === "image/jpg" ? "image/jpeg" : mime;
  return (ENHANCEMENT_IMAGE_TYPES as readonly string[]).includes(normalized)
    ? normalized as EnhancementImageMimeType
    : null;
}

function bytesFromBase64(value: string): Uint8Array {
  try {
    const decoded = globalThis.atob(value);
    return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
  } catch {
    throw new EnhancementReporterError("invalid_image", "An image is not valid base64 data.");
  }
}

function base64FromBytes(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return globalThis.btoa(binary);
}

function signatureMatches(mime: EnhancementImageMimeType, bytes: Uint8Array): boolean {
  if (mime === "image/png") return bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value);
  if (mime === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === "image/gif") return new TextDecoder("ascii").decode(bytes.subarray(0, 6)) === "GIF87a" || new TextDecoder("ascii").decode(bytes.subarray(0, 6)) === "GIF89a";
  return bytes.length >= 12 && new TextDecoder("ascii").decode(bytes.subarray(0, 4)) === "RIFF" && new TextDecoder("ascii").decode(bytes.subarray(8, 12)) === "WEBP";
}

function extension(mime: EnhancementImageMimeType): string {
  return ({ "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp" } as const)[mime];
}

function filename(value: unknown, mime: EnhancementImageMimeType, index: number): string {
  return clean(value, 200).replace(/[^\w.\- ]+/gu, "_").trim().slice(0, 160) || `enhancement-image-${index + 1}.${extension(mime)}`;
}

async function imageBytes(input: EnhancementImageInput): Promise<{ bytes: Uint8Array; mime: EnhancementImageMimeType }> {
  if (typeof input.data === "string") {
    const match = input.data.match(/^data:([^;,]+);base64,([A-Za-z0-9+/]+={0,2})$/u);
    if (!match || match[2].length % 4 !== 0) throw new EnhancementReporterError("invalid_image", "Images must use valid base64 data URLs.");
    const mime = normalizedMimeType(match[1]);
    if (!mime) throw new EnhancementReporterError("invalid_image_type", "Images must be PNG, JPEG, GIF, or WebP.");
    return { bytes: bytesFromBase64(match[2]), mime };
  }
  const mime = normalizedMimeType(input.mimeType || (input.data instanceof Blob ? input.data.type : null));
  if (!mime) throw new EnhancementReporterError("invalid_image_type", "Images must be PNG, JPEG, GIF, or WebP.");
  if (input.data instanceof Blob) return { bytes: new Uint8Array(await input.data.arrayBuffer()), mime };
  if (input.data instanceof ArrayBuffer) return { bytes: new Uint8Array(input.data), mime };
  return { bytes: new Uint8Array(input.data.buffer, input.data.byteOffset, input.data.byteLength), mime };
}

export async function normalizeEnhancementImages(inputs: readonly EnhancementImageInput[] = []): Promise<readonly NormalizedEnhancementImage[]> {
  if (inputs.length > MAX_ENHANCEMENT_IMAGES) throw new EnhancementReporterError("image_count_exceeded", `Attach at most ${MAX_ENHANCEMENT_IMAGES} images.`);
  let total = 0;
  const result: NormalizedEnhancementImage[] = [];
  for (let index = 0; index < inputs.length; index += 1) {
    const input = inputs[index];
    const { bytes, mime } = await imageBytes(input);
    if (!bytes.length || !signatureMatches(mime, bytes)) throw new EnhancementReporterError("invalid_image", "An image did not match its declared file type.");
    if (bytes.length > MAX_ENHANCEMENT_IMAGE_BYTES) throw new EnhancementReporterError("image_too_large", "Each image must be 5 MiB or smaller.");
    total += bytes.length;
    if (total > MAX_ENHANCEMENT_IMAGE_TOTAL_BYTES) throw new EnhancementReporterError("image_total_too_large", "Attached images must total 15 MiB or less.");
    result.push({
      filename: filename(input.filename, mime, index),
      data_url: `data:${mime};base64,${base64FromBytes(bytes)}`,
      mime_type: mime,
      size_bytes: bytes.length,
      source: input.source === "clipboard" ? "clipboard" : "upload",
    });
  }
  return Object.freeze(result);
}

async function responseJson(response: Response): Promise<any> {
  const text = await response.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = null; }
  if (!response.ok) {
    throw new EnhancementReporterError(clean(body?.code, 120) || "request_rejected", clean(body?.error, 500) || "Handrail rejected the enhancement request.", response.status);
  }
  return body;
}

export interface EnhancementReporterClient {
  readonly enabled: boolean;
  readonly endpoint: string;
  readonly reporterEmail?: string;
  readonly notificationsEnabled?: boolean;
  discover(): Promise<EnhancementReporterDiscovery>;
  submit(input: EnhancementRequestInput): Promise<EnhancementSubmissionResult>;
  subscribeToUpdates(requestId: string, preference: EnhancementNotificationPreference): Promise<EnhancementNotificationSubscription>;
  list(options?: EnhancementHistoryListOptions): Promise<EnhancementRequestPage>;
  lookup(requestId: string): Promise<EnhancementRequestRecord>;
  releaseStatus(requestId: string): Promise<any>;
  dismiss(requestId: string): Promise<EnhancementDismissResult>;
  restore(requestId: string): Promise<EnhancementRestoreResult>;
  dismissSucceeded(): Promise<EnhancementDismissSucceededResult>;
  cancel(requestId: string, reason?: string): Promise<EnhancementRequestRecord>;
  attachmentUrl(requestId: string, attachmentId: string): string;
}

export function createEnhancementReporter(config: EnhancementReporterConfig = {}): EnhancementReporterClient {
  const endpoint = endpointPath(config.endpoint);
  const fetchImpl = config.fetch || globalThis.fetch;
  const enabled = config.enabled !== false;
  const reporterEmail = clean(config.reporterEmail, 254).toLowerCase();
  const notificationsEnabled = config.notificationsEnabled !== false;
  const defaultConversationId = clean(config.conversationId, 512) || randomId();
  if (enabled && typeof fetchImpl !== "function") throw new EnhancementReporterError("invalid_configuration", "A fetch implementation is required.");

  const request = async (path: string, init: RequestInit = {}) => {
    if (!enabled) throw new EnhancementReporterError("disabled", "Enhancement reporting is disabled.");
    return responseJson(await fetchImpl(`${endpoint}${path}`, {
      ...init,
      credentials: "same-origin",
      headers: { accept: "application/json", ...(init.body ? { "content-type": "application/json" } : {}), ...init.headers },
    }));
  };

  const subscribeToUpdates = async (
    requestId: string,
    preference: EnhancementNotificationPreference,
  ): Promise<EnhancementNotificationSubscription> => {
    const id = clean(requestId, 160);
    if (!id || preference?.notifyOnResolution !== true) {
      throw new EnhancementReporterError("invalid_notification", "A valid notification preference is required.");
    }
    const result = await request(`/requests/${encodeURIComponent(id)}/subscription`, {
      method: "POST",
      body: JSON.stringify({ reporter_notification: {
        notify_on_resolution: true,
        consent_version: clean(preference.consentVersion, 40) || "v1",
      } }),
    });
    const subscription = result?.notification_subscription;
    if (!subscription || subscription.active !== true) {
      throw new EnhancementReporterError(
        "subscription_rejected",
        "Update notifications could not be enabled.",
      );
    }
    return Object.freeze({
      active: true,
      created: subscription.created === true,
      recipient_hint: clean(subscription.recipient_hint, 320) || null,
      subscribed_at: clean(subscription.subscribed_at, 80) || null,
    });
  };

  return Object.freeze({
    enabled,
    endpoint,
    reporterEmail,
    notificationsEnabled,
    discover: () => request("/policy"),
    async submit(input: EnhancementRequestInput) {
      const title = clean(input.title, 500);
      const description = clean(input.description, 20_000);
      if (!title || !description) throw new EnhancementReporterError("invalid_request", "A title and description are required.");
      const images = await normalizeEnhancementImages(input.images);
      const route = clean(input.context?.route, 2_000) || (typeof location !== "undefined" ? `${location.pathname}${location.search}` : "");
      const viewport = clean(input.context?.viewport, 80) || (typeof window !== "undefined" ? `${window.innerWidth}x${window.innerHeight}` : "");
      const result = await request("", {
        method: "POST",
        body: JSON.stringify({
          idempotency_key: clean(input.idempotencyKey, 255) || randomId(),
          external_conversation_id: clean(input.conversationId, 512) || defaultConversationId,
          title,
          description,
          priority: input.priority || "medium",
          context: {
            route: route || null,
            page_title: clean(input.context?.pageTitle, 500) || (typeof document !== "undefined" ? document.title : null),
            app_version: clean(input.context?.appVersion || config.appVersion, 160) || null,
            viewport: viewport || null,
          },
          reporter_sdk: reporterIdentity("browser"),
          automation_requests: {
            run_work_request: input.automationRequests?.run_work_request === true,
            deploy_staging: input.automationRequests?.deploy_staging === true,
            deploy_production: input.automationRequests?.deploy_production === true,
          },
          attachments: images.map(({ mime_type: _mime, size_bytes: _size, ...image }) => image),
        }),
      });
      if (input.notification?.notifyOnResolution !== true) return result;
      const requestId = clean(result?.request?.id, 160);
      if (!requestId) {
        return {
          ...result,
          notification_subscription: null,
          notification_warning: "The enhancement was sent, but update notifications could not be enabled.",
        };
      }
      try {
        const subscription = await subscribeToUpdates(requestId, input.notification);
        return { ...result, notification_subscription: subscription, notification_warning: null };
      } catch {
        return {
          ...result,
          notification_subscription: null,
          notification_warning: "The enhancement was sent, but update notifications could not be enabled.",
        };
      }
    },
    subscribeToUpdates,
    list(options: EnhancementHistoryListOptions = {}) {
      const { limit = 20, offset = 0, search, statusGroup, sort, visibility } = options;
      const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
      if (clean(search, 200)) query.set("search", clean(search, 200));
      if (statusGroup) query.set("status_group", statusGroup);
      if (sort) query.set("sort", sort);
      if (visibility) query.set("visibility", visibility);
      return request(`?${query.toString()}`);
    },
    lookup(requestId: string) { return request(`/requests/${encodeURIComponent(requestId)}`); },
    releaseStatus(requestId: string) { return request(`/requests/${encodeURIComponent(requestId)}/release-status`); },
    dismiss(requestId: string) { return request(`/requests/${encodeURIComponent(requestId)}/dismiss`, { method: "POST", body: "{}" }); },
    restore(requestId: string) { return request(`/requests/${encodeURIComponent(requestId)}/dismiss`, { method: "DELETE" }); },
    dismissSucceeded() { return request("/requests/dismiss-succeeded", { method: "POST", body: "{}" }); },
    cancel(requestId: string, reason?: string) { return request(`/requests/${encodeURIComponent(requestId)}/cancel`, { method: "POST", body: JSON.stringify({ reason: clean(reason, 2_000) || null }) }); },
    attachmentUrl(requestId: string, attachmentId: string) { return `${endpoint}/requests/${encodeURIComponent(requestId)}/attachments/${encodeURIComponent(attachmentId)}`; },
  });
}
