import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type ClipboardEvent as ReactClipboardEvent,
  type DragEvent as ReactDragEvent,
  type FormEvent,
  type KeyboardEvent,
  type ReactElement,
} from "react";

import { useOptionalEnhancementReporter } from "./react-provider";
import {
  ENHANCEMENT_IMAGE_TYPES,
  MAX_ENHANCEMENT_IMAGES,
  MAX_ENHANCEMENT_IMAGE_BYTES,
  MAX_ENHANCEMENT_IMAGE_TOTAL_BYTES,
  enhancementReleaseSummary,
  type EnhancementHistoryCapabilities,
  type EnhancementHistoryListOptions,
  type EnhancementHistorySort,
  type EnhancementHistoryStatusGroup,
  type EnhancementHistorySummary,
  type EnhancementHistoryVisibility,
  type EnhancementImageInput,
  type EnhancementReporterClient,
  type EnhancementRequestRecord,
} from "./reporter";

export type EnhancementReporterThemeMode = "auto" | "light" | "dark";

export interface EnhancementReporterThemeTokens {
  readonly accent: string;
  readonly accentText: string;
  readonly surface: string;
  readonly surfaceMuted: string;
  readonly text: string;
  readonly mutedText: string;
  readonly border: string;
  readonly overlay: string;
  readonly dangerSurface: string;
  readonly dangerText: string;
  readonly successSurface: string;
  readonly successText: string;
  readonly radius: string;
  readonly fontFamily: string;
}

export interface EnhancementReporterAppearance {
  /** Defaults to auto, following the host color scheme with polished SDK defaults. */
  readonly themeMode?: EnhancementReporterThemeMode;
  /** Overrides individual packaged-UI design tokens without changing behavior. */
  readonly tokens?: Partial<EnhancementReporterThemeTokens>;
  /** Applied to the dialog element. */
  readonly className?: string;
  /** Applied to the overlay alongside scoped design-token variables. */
  readonly style?: CSSProperties;
}

export interface EnhancementReporterDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly client?: EnhancementReporterClient;
  readonly appVersion?: string;
  readonly heading?: string;
  readonly appearance?: EnhancementReporterAppearance;
  /** Number of recent requests shown per page. Defaults to 10 and is capped at 50. */
  readonly historyPageSize?: number;
}

export interface EnhancementReporterButtonProps
  extends Omit<EnhancementReporterDialogProps, "open" | "onClose"> {
  readonly label?: string;
  readonly className?: string;
  readonly style?: CSSProperties;
}

interface SelectedImage {
  readonly id: string;
  readonly input: EnhancementImageInput;
  readonly name: string;
  readonly preview: string | null;
  readonly size: number;
}

interface EnhancementPolicyCells {
  readonly run_work_request: "pending" | "ask" | "always";
}

type UiVariables = CSSProperties & Record<`--handrail-enhancement-${string}`, string>;
type DialogTab = "new" | "history";

const RESPONSIVE_DIALOG_CSS = `
@media (max-width: 860px) {
  [data-handrail-enhancement-report-layout="true"] { grid-template-columns: minmax(0, 1fr) !important; }
  [data-handrail-enhancement-context="true"] { order: -1; }
  [data-handrail-enhancement-history-header="true"] { display: none !important; }
  [data-handrail-enhancement-history-row="true"] {
    grid-template-columns: minmax(0, 1fr) auto !important;
    gap: 8px 14px !important;
    padding: 14px !important;
  }
  [data-handrail-enhancement-history-cell="secondary"] { display: none !important; }
  [data-handrail-enhancement-history-cell="status"] { grid-column: 1; }
  [data-handrail-enhancement-history-cell="action"] { grid-column: 2; grid-row: 1 / span 2; }
}
@media (max-width: 560px) {
  [data-handrail-enhancement-reporter="overlay"] { padding: 0 !important; }
  [data-handrail-enhancement-reporter-dialog="true"] {
    width: 100vw !important;
    height: 100dvh !important;
    max-height: none !important;
    border: 0 !important;
    border-radius: 0 !important;
  }
  [data-handrail-enhancement-header="true"] { padding: 16px 18px 14px !important; }
  [data-handrail-enhancement-content="true"] { padding: 12px 14px !important; }
  [data-handrail-enhancement-tabs="true"] { margin-bottom: 14px !important; }
}
`;

const PENDING_POLICY: EnhancementPolicyCells = Object.freeze({
  run_work_request: "pending",
});

const LIGHT_TOKENS: EnhancementReporterThemeTokens = Object.freeze({
  accent: "#2563eb",
  accentText: "#ffffff",
  surface: "#ffffff",
  surfaceMuted: "#f7f9fc",
  text: "#172033",
  mutedText: "#667085",
  border: "#dbe2ec",
  overlay: "rgba(15, 23, 42, 0.62)",
  dangerSurface: "#fff1f0",
  dangerText: "#b42318",
  successSurface: "#ecfdf3",
  successText: "#027a48",
  radius: "16px",
  fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif",
});

const DARK_TOKENS: EnhancementReporterThemeTokens = Object.freeze({
  accent: "#78a9ff",
  accentText: "#071426",
  surface: "#151a23",
  surfaceMuted: "#1e2633",
  text: "#f5f7fa",
  mutedText: "#aeb8c8",
  border: "#394455",
  overlay: "rgba(2, 6, 23, 0.76)",
  dangerSurface: "#3a1d23",
  dangerText: "#ffb4b8",
  successSurface: "#173326",
  successText: "#95ddb7",
  radius: "16px",
  fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif",
});

const AUTO_TOKENS: EnhancementReporterThemeTokens = Object.freeze({
  accent: "light-dark(#2563eb, #78a9ff)",
  accentText: "light-dark(#ffffff, #071426)",
  surface: "light-dark(#ffffff, #151a23)",
  surfaceMuted: "light-dark(#f7f9fc, #1e2633)",
  text: "light-dark(#172033, #f5f7fa)",
  mutedText: "light-dark(#667085, #aeb8c8)",
  border: "light-dark(#dbe2ec, #394455)",
  overlay: "rgba(2, 6, 23, 0.66)",
  dangerSurface: "light-dark(#fff1f0, #3a1d23)",
  dangerText: "light-dark(#b42318, #ffb4b8)",
  successSurface: "light-dark(#ecfdf3, #173326)",
  successText: "light-dark(#027a48, #95ddb7)",
  radius: "16px",
  fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif",
});

const focusableSelector = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function policyCells(value: unknown): EnhancementPolicyCells {
  const discovery = value as any;
  const cells = discovery?.enhancement_reporting?.policy?.cells;
  const run = ["pending", "ask", "always"].includes(cells?.run_work_request)
    ? cells.run_work_request
    : "pending";
  return {
    run_work_request: run,
  };
}

function appearanceVariables(
  appearance: EnhancementReporterAppearance | undefined,
): UiVariables {
  const mode = appearance?.themeMode || "auto";
  const base = mode === "dark"
    ? DARK_TOKENS
    : mode === "light"
      ? LIGHT_TOKENS
      : AUTO_TOKENS;
  const tokens = { ...base, ...appearance?.tokens };
  return {
    "--handrail-enhancement-accent": tokens.accent,
    "--handrail-enhancement-accent-text": tokens.accentText,
    "--handrail-enhancement-surface": tokens.surface,
    "--handrail-enhancement-surface-muted": tokens.surfaceMuted,
    "--handrail-enhancement-text": tokens.text,
    "--handrail-enhancement-muted-text": tokens.mutedText,
    "--handrail-enhancement-border": tokens.border,
    "--handrail-enhancement-overlay": tokens.overlay,
    "--handrail-enhancement-danger-surface": tokens.dangerSurface,
    "--handrail-enhancement-danger-text": tokens.dangerText,
    "--handrail-enhancement-success-surface": tokens.successSurface,
    "--handrail-enhancement-success-text": tokens.successText,
    "--handrail-enhancement-radius": tokens.radius,
    "--handrail-enhancement-font-family": tokens.fontFamily,
    colorScheme: mode === "auto" ? "inherit" : mode,
    ...appearance?.style,
  };
}

const styles: Record<string, CSSProperties> = {
  visuallyHidden: {
    position: "absolute",
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: "hidden",
    clip: "rect(0, 0, 0, 0)",
    whiteSpace: "nowrap",
    border: 0,
  },
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 2147483000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    background: "var(--handrail-enhancement-overlay)",
    backdropFilter: "blur(3px)",
  },
  dialog: {
    display: "flex",
    flexDirection: "column",
    width: "min(1280px, calc(100vw - 40px))",
    height: "min(900px, calc(100dvh - 40px))",
    maxHeight: "calc(100vh - 40px)",
    overflow: "hidden",
    border: "1px solid var(--handrail-enhancement-border)",
    borderRadius: "var(--handrail-enhancement-radius)",
    background: "var(--handrail-enhancement-surface)",
    color: "var(--handrail-enhancement-text)",
    boxShadow: "0 30px 90px rgba(0, 0, 0, 0.34)",
    fontFamily: "var(--handrail-enhancement-font-family)",
    fontSize: 14,
    lineHeight: 1.45,
    isolation: "isolate",
  },
  header: {
    display: "flex",
    flexShrink: 0,
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    padding: "18px 24px 16px",
    borderBottom: "1px solid var(--handrail-enhancement-border)",
  },
  content: {
    flex: 1,
    minHeight: 0,
    overflow: "auto",
    padding: "16px 20px",
    background: "var(--handrail-enhancement-surface)",
  },
  tabs: {
    display: "flex",
    gap: 8,
    padding: 5,
    marginBottom: 16,
    border: "1px solid var(--handrail-enhancement-border)",
    borderRadius: 14,
    background: "var(--handrail-enhancement-surface-muted)",
  },
  tab: {
    flex: 1,
    border: "1px solid transparent",
    borderRadius: 10,
    padding: "8px 14px",
    cursor: "pointer",
    color: "inherit",
    background: "transparent",
    font: "inherit",
    fontWeight: 700,
    minHeight: 38,
  },
  activeTab: {
    borderColor: "var(--handrail-enhancement-border)",
    background: "var(--handrail-enhancement-surface)",
    boxShadow: "0 3px 10px rgba(15, 23, 42, 0.08)",
  },
  label: {
    display: "grid",
    gap: 7,
    marginBottom: 12,
    color: "inherit",
    fontSize: 13,
    fontWeight: 700,
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid var(--handrail-enhancement-border)",
    borderRadius: 11,
    padding: "9px 12px",
    color: "inherit",
    background: "var(--handrail-enhancement-surface)",
    font: "inherit",
    minHeight: 40,
    outlineOffset: 2,
  },
  fieldset: {
    margin: "12px 0 0",
    padding: 12,
    border: "1px solid var(--handrail-enhancement-border)",
    borderRadius: 11,
  },
  checkboxLabel: {
    display: "flex",
    gap: 9,
    alignItems: "flex-start",
    marginTop: 10,
    color: "inherit",
    fontSize: 13,
    cursor: "pointer",
  },
  drop: {
    border: "1px dashed var(--handrail-enhancement-border)",
    borderRadius: 12,
    padding: 12,
    background: "var(--handrail-enhancement-surface-muted)",
    fontSize: 13,
    color: "var(--handrail-enhancement-muted-text)",
  },
  imageGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
    gap: 10,
    marginTop: 12,
  },
  imageCard: {
    position: "relative",
    minWidth: 0,
    border: "1px solid var(--handrail-enhancement-border)",
    borderRadius: 9,
    overflow: "hidden",
    background: "var(--handrail-enhancement-surface)",
  },
  button: {
    border: "1px solid transparent",
    borderRadius: 10,
    padding: "8px 14px",
    cursor: "pointer",
    font: "inherit",
    fontWeight: 700,
    minHeight: 38,
    outlineOffset: 2,
  },
  status: { marginBottom: 14, borderRadius: 11, padding: "11px 14px", fontSize: 13 },
  historyControls: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(160px, 100%), 1fr))",
    gap: 10,
    marginBottom: 14,
  },
  historyItem: {
    display: "grid",
    gridTemplateColumns: "minmax(240px, 2.2fr) minmax(100px, .8fr) minmax(130px, 1fr) minmax(130px, 1fr) minmax(120px, .8fr) 112px",
    alignItems: "center",
    gap: 12,
    padding: "12px 14px",
    borderBottom: "1px solid var(--handrail-enhancement-border)",
    background: "var(--handrail-enhancement-surface)",
  },
  historyList: {
    minHeight: 0,
    overflow: "hidden auto",
    border: "1px solid var(--handrail-enhancement-border)",
    borderRadius: 14,
    background: "var(--handrail-enhancement-surface-muted)",
  },
  historyListHeader: {
    display: "grid",
    gridTemplateColumns: "minmax(240px, 2.2fr) minmax(100px, .8fr) minmax(130px, 1fr) minmax(130px, 1fr) minmax(120px, .8fr) 112px",
    gap: 12,
    padding: "9px 14px",
    color: "var(--handrail-enhancement-muted-text)",
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  },
  formActions: {
    position: "sticky",
    bottom: -16,
    zIndex: 2,
    display: "flex",
    justifyContent: "flex-end",
    gap: 9,
    flexWrap: "wrap",
    margin: "16px -20px -16px",
    padding: "12px 20px",
    borderTop: "1px solid var(--handrail-enhancement-border)",
    background: "var(--handrail-enhancement-surface)",
  },
};

function buttonStyle(kind: "primary" | "secondary"): CSSProperties {
  return {
    ...styles.button,
    ...(kind === "primary"
      ? { background: "var(--handrail-enhancement-accent)", color: "var(--handrail-enhancement-accent-text)" }
      : { borderColor: "var(--handrail-enhancement-border)", background: "var(--handrail-enhancement-surface-muted)", color: "var(--handrail-enhancement-text)" }),
  };
}

function displayLabel(value: string): string {
  const normalized = value.replaceAll("_", " ").trim();
  return normalized
    ? `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`
    : value;
}

function requestDate(value: string | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? "—"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function selectedFile(
  file: File,
  source: "upload" | "clipboard",
  previews: Set<string>,
): SelectedImage {
  const preview = typeof URL !== "undefined" && typeof URL.createObjectURL === "function"
    ? URL.createObjectURL(file)
    : null;
  if (preview) previews.add(preview);
  return {
    id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
    name: file.name || `${source}-image`,
    preview,
    size: file.size,
    input: {
      data: file,
      filename: file.name,
      mimeType: file.type as EnhancementImageInput["mimeType"],
      source,
    },
  };
}

function revokePreview(image: SelectedImage, previews: Set<string>) {
  if (!image.preview) return;
  if (typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
    URL.revokeObjectURL(image.preview);
  }
  previews.delete(image.preview);
}

function HistoryRow({
  request,
  busy,
  expanded,
  onToggle,
  canRestore,
  onDismiss,
  onRestore,
}: {
  readonly request: EnhancementRequestRecord;
  readonly busy: boolean;
  readonly expanded: boolean;
  readonly onToggle: (requestId: string) => void;
  readonly canRestore: boolean;
  readonly onDismiss: (requestId: string) => Promise<void>;
  readonly onRestore: (requestId: string) => Promise<void>;
}): ReactElement {
  const release = enhancementReleaseSummary(request);
  return <article role="row" data-handrail-enhancement-history-row="true" style={styles.historyItem}>
    <div role="cell" style={{ minWidth: 0 }}>
      <strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13 }}>{request.title}</strong>
      <span style={{ display: "block", marginTop: 3, overflow: "hidden", color: "var(--handrail-enhancement-muted-text)", fontSize: 10, textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{request.id}</span>
    </div>
    <span role="cell" data-handrail-enhancement-history-cell="secondary" style={{ color: "var(--handrail-enhancement-muted-text)", fontSize: 12 }}>{requestDate(request.created_at)}</span>
    <span role="cell" data-handrail-enhancement-history-cell="secondary" style={{ overflow: "hidden", color: "var(--handrail-enhancement-muted-text)", fontSize: 12, textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{request.linked_work_request?.id || "Pending review"}</span>
    <div role="cell" data-handrail-enhancement-history-cell="status">
      <span style={{ display: "inline-block", padding: "4px 9px", border: "1px solid var(--handrail-enhancement-border)", borderRadius: 999, color: request.status_group === "needs_attention" ? "var(--handrail-enhancement-danger-text)" : request.status_group === "succeeded" ? "var(--handrail-enhancement-success-text)" : "var(--handrail-enhancement-accent)", background: request.status_group === "needs_attention" ? "var(--handrail-enhancement-danger-surface)" : request.status_group === "succeeded" ? "var(--handrail-enhancement-success-surface)" : "var(--handrail-enhancement-surface-muted)", fontSize: 11, fontWeight: 800 }}>{displayLabel(request.status)}</span>
    </div>
    <span role="cell" data-handrail-enhancement-history-cell="secondary" style={{ color: "var(--handrail-enhancement-muted-text)", fontSize: 11 }}>{release.label}</span>
    <div role="cell" data-handrail-enhancement-history-cell="action" style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
      <button type="button" aria-expanded={expanded} aria-label={`View ${request.title}`} onClick={() => onToggle(request.id)} style={{ border: 0, padding: "6px 2px", color: "var(--handrail-enhancement-accent)", background: "transparent", cursor: "pointer", font: "inherit", fontSize: 12, fontWeight: 800 }}>View</button>
      {request.dismissed && canRestore
        ? <button type="button" aria-label={`Restore ${request.title}`} disabled={busy} onClick={() => void onRestore(request.id)} style={{ border: 0, padding: "6px 2px", color: "var(--handrail-enhancement-accent)", background: "transparent", cursor: busy ? "wait" : "pointer", font: "inherit", fontSize: 12, fontWeight: 800 }}>{busy ? "Restoring…" : "Restore"}</button>
        : !request.dismissed && <button type="button" aria-label={`Dismiss ${request.title}`} disabled={busy} onClick={() => void onDismiss(request.id)} style={{ border: 0, padding: "6px 2px", color: "var(--handrail-enhancement-accent)", background: "transparent", cursor: busy ? "wait" : "pointer", font: "inherit", fontSize: 12, fontWeight: 800 }}>{busy ? "Dismissing…" : "Dismiss"}</button>}
    </div>
    {expanded && <div role="cell" data-handrail-enhancement-history-detail="true" style={{ gridColumn: "1 / -1", display: "grid", gap: 10, padding: "10px 12px", border: "1px solid var(--handrail-enhancement-border)", borderRadius: 9, color: "var(--handrail-enhancement-muted-text)", background: "var(--handrail-enhancement-surface-muted)", fontSize: 11 }}>
      <span><strong style={{ display: "block", color: "var(--handrail-enhancement-text)" }}>Request details</strong>{request.description || "No additional description is available."}</span>
      {Boolean(request.attachments?.length) && <span><strong style={{ color: "var(--handrail-enhancement-text)" }}>Attachments:</strong> {request.attachments!.map((attachment) => attachment.filename).join(", ")}</span>}
    </div>}
  </article>;
}

export function EnhancementReporterDialog({
  open,
  onClose,
  client: explicitClient,
  appVersion,
  heading = "Suggest an enhancement",
  appearance,
  historyPageSize = 10,
}: EnhancementReporterDialogProps): ReactElement | null {
  const contextClient = useOptionalEnhancementReporter();
  const client = explicitClient || contextClient;
  if (!client) {
    throw new Error(
      "EnhancementReporterDialog requires a client or EnhancementReporterProvider",
    );
  }

  const [tab, setTab] = useState<DialogTab>("new");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [notifyOnResolution, setNotifyOnResolution] = useState(false);
  const [notificationAvailable, setNotificationAvailable] = useState(false);
  const [notificationRecipientHint, setNotificationRecipientHint] = useState<string | null>(null);
  const [images, setImages] = useState<SelectedImage[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [history, setHistory] = useState<readonly EnhancementRequestRecord[]>([]);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historySummary, setHistorySummary] = useState<EnhancementHistorySummary | null>(null);
  const [historyAvailable, setHistoryAvailable] = useState(false);
  const [historyCapabilities, setHistoryCapabilities] = useState<EnhancementHistoryCapabilities | null>(null);
  const [historySearch, setHistorySearch] = useState("");
  const [historyStatus, setHistoryStatus] = useState<EnhancementHistoryStatusGroup | "">("");
  const [historySort, setHistorySort] = useState<EnhancementHistorySort>("newest");
  const [historyVisibility, setHistoryVisibility] = useState<EnhancementHistoryVisibility>("active");
  const [policy, setPolicy] = useState<EnhancementPolicyCells>(PENDING_POLICY);
  const [automationRequests, setAutomationRequests] = useState({
    run_work_request: false,
  });
  const [discovering, setDiscovering] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [busyHistoryId, setBusyHistoryId] = useState<string | null>(null);
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<EnhancementRequestRecord | null>(null);
  const [notificationNotice, setNotificationNotice] = useState<string | null>(null);
  const previewUrls = useRef(new Set<string>());
  const historyLoadedRef = useRef(false);
  const dialogRef = useRef<HTMLElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const headingId = useId();
  const descriptionId = useId();
  const newTabId = useId();
  const historyTabId = useId();
  const newPanelId = useId();
  const historyPanelId = useId();
  const pageSize = Math.max(1, Math.min(50, Math.floor(historyPageSize) || 10));
  const resolvedAppVersion = appVersion || client.appVersion;
  const attachedContext = {
    route: typeof location !== "undefined" ? `${location.pathname}${location.search}` : undefined,
    pageTitle: typeof document !== "undefined" ? document.title || undefined : undefined,
    appVersion: resolvedAppVersion,
    viewport: typeof window !== "undefined" ? `${window.innerWidth}x${window.innerHeight}` : undefined,
  };

  const currentHistoryQuery = useCallback((): EnhancementHistoryListOptions => ({
    search: historySearch.trim() || undefined,
    statusGroup: historyStatus || undefined,
    sort: historySort,
    visibility: historyVisibility,
  }), [historySearch, historySort, historyStatus, historyVisibility]);

  const loadHistory = useCallback(async (
    offset = 0,
    query: EnhancementHistoryListOptions = currentHistoryQuery(),
  ) => {
    setLoadingHistory(true);
    setError(null);
    try {
      const page = await client.list({ limit: pageSize, offset, ...query });
      setHistory((current) => offset === 0
        ? page.requests
        : [...current, ...page.requests.filter(
            (request) => !current.some((existing) => existing.id === request.id),
          )]);
      setHistoryHasMore(page.pagination.has_more);
      setHistoryTotal(page.pagination.total);
      setHistorySummary(page.summary);
    } catch (caught) {
      setError(caught instanceof Error
        ? caught.message
        : "Could not load enhancement requests.");
    } finally {
      setLoadingHistory(false);
    }
  }, [client, currentHistoryQuery, pageSize]);

  useEffect(() => () => {
    for (const url of previewUrls.current) {
      if (typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
        URL.revokeObjectURL(url);
      }
    }
    previewUrls.current.clear();
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setTab("new");
    setHistoryAvailable(false);
    historyLoadedRef.current = false;
    setHistoryCapabilities(null);
    setHistory([]);
    setHistoryHasMore(false);
    setHistoryTotal(0);
    setHistorySummary(null);
    setPolicy(PENDING_POLICY);
    setAutomationRequests({
      run_work_request: false,
    });
    setNotifyOnResolution(false);
    setNotificationAvailable(false);
    setNotificationRecipientHint(null);
    setNotificationNotice(null);
    setDiscovering(true);
    void client.discover().then((discovery) => {
      if (cancelled) return;
      const capabilities = discovery?.enhancement_reporting?.history || null;
      const ownedHistoryEnabled = capabilities?.enabled === true
        || (capabilities?.enabled === undefined
          && discovery?.enhancement_reporting?.user_enabled === true);
      setHistoryAvailable(ownedHistoryEnabled);
      setHistoryCapabilities(ownedHistoryEnabled ? capabilities : null);
      if (capabilities?.sorts.length && !capabilities.sorts.includes("newest")) {
        setHistorySort(capabilities.sorts[0]);
      }
      if (capabilities?.visibilities.length && !capabilities.visibilities.includes("active")) {
        setHistoryVisibility(capabilities.visibilities[0]);
      }
      setPolicy(policyCells(discovery));
      setNotificationAvailable(discovery?.reporter_notifications?.available === true);
      setNotificationRecipientHint(
        discovery?.reporter_notifications?.recipient_hint || null,
      );
    }).catch(() => {
      if (!cancelled) {
        setHistoryAvailable(false);
        setHistoryCapabilities(null);
        setNotificationAvailable(false);
        setNotificationRecipientHint(null);
      }
    }).finally(() => {
      if (!cancelled) setDiscovering(false);
    });
    return () => { cancelled = true; };
  }, [client, open]);

  useEffect(() => {
    if (!notificationAvailable && notifyOnResolution) {
      setNotifyOnResolution(false);
    }
  }, [notificationAvailable, notifyOnResolution]);

  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const frame = typeof requestAnimationFrame === "function"
      ? requestAnimationFrame(() => {
          dialogRef.current?.querySelector<HTMLElement>(focusableSelector)?.focus();
        })
      : null;
    return () => {
      if (frame !== null && typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(frame);
      }
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    };
  }, [open]);

  useEffect(() => {
    if (open && tab === "history" && !historyLoadedRef.current) {
      historyLoadedRef.current = true;
      void loadHistory(0);
    }
  }, [loadHistory, open, tab]);

  const addFiles = useCallback((
    files: readonly File[],
    source: "upload" | "clipboard",
  ) => {
    const allowed = new Set<string>(ENHANCEMENT_IMAGE_TYPES);
    const rejectedType = files.some((file) => !allowed.has(file.type));
    const rejectedSize = files.some((file) => file.size > MAX_ENHANCEMENT_IMAGE_BYTES);
    if (rejectedType) {
      setError("Attach only PNG, JPEG, GIF, or WebP images.");
      return;
    }
    if (rejectedSize) {
      setError("Each image must be 5 MiB or smaller.");
      return;
    }
    if (images.length + files.length > MAX_ENHANCEMENT_IMAGES) {
      setError(`Attach at most ${MAX_ENHANCEMENT_IMAGES} images.`);
      return;
    }
    const currentBytes = images.reduce((total, image) => total + image.size, 0);
    const addedBytes = files.reduce((total, file) => total + file.size, 0);
    if (currentBytes + addedBytes > MAX_ENHANCEMENT_IMAGE_TOTAL_BYTES) {
      setError("Attached images must total 15 MiB or less.");
      return;
    }
    setImages((current) => [
      ...current,
      ...files.map((file) => selectedFile(file, source, previewUrls.current)),
    ]);
    setError(null);
  }, [images]);

  const onFiles = (event: ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(event.target.files || []), "upload");
    event.target.value = "";
  };

  const onPaste = (event: ReactClipboardEvent<HTMLElement>) => {
    const files = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file));
    if (!files.length) return;
    event.preventDefault();
    addFiles(files, "clipboard");
  };

  const onImageDragOver = (event: ReactDragEvent<HTMLElement>) => {
    if (!Array.from(event.dataTransfer.types).includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setDragActive(true);
  };

  const onImageDrop = (event: ReactDragEvent<HTMLElement>) => {
    const files = Array.from(event.dataTransfer.files);
    if (!files.length) return;
    event.preventDefault();
    setDragActive(false);
    addFiles(files, "upload");
  };

  const removeImage = (id: string) => setImages((current) => current.filter((image) => {
    if (image.id !== id) return true;
    revokePreview(image, previewUrls.current);
    return false;
  }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSubmitted(null);
    try {
      const result = await client.submit({
        title,
        description,
        priority,
        images: images.map((image) => image.input),
        context: attachedContext,
        automationRequests,
        ...(notifyOnResolution
          ? { notification: { notifyOnResolution: true } }
          : {}),
      });
      setSubmitted(result.request);
      setNotificationNotice(
        result.notification_warning
        || (notifyOnResolution && result.notification_subscription?.active === true
          ? "Email updates are enabled for this request."
          : null),
      );
      setTitle("");
      setDescription("");
      setPriority("medium");
      for (const image of images) revokePreview(image, previewUrls.current);
      setImages([]);
      setAutomationRequests({
        run_work_request: false,
      });
      setNotifyOnResolution(false);
    } catch (caught) {
      setError(caught instanceof Error
        ? caught.message
        : "Could not submit the enhancement request.");
    } finally {
      setSubmitting(false);
    }
  };

  const dismissRequest = async (requestId: string) => {
    setBusyHistoryId(requestId);
    setError(null);
    try {
      await client.dismiss(requestId);
      if (historyVisibility === "active") {
        setHistory((current) => current.filter((request) => request.id !== requestId));
        setHistoryTotal((current) => Math.max(0, current - 1));
      } else {
        setHistory((current) => current.map((request) => request.id === requestId
          ? { ...request, dismissed: true }
          : request));
      }
    } catch (caught) {
      setError(caught instanceof Error
        ? caught.message
        : "Could not dismiss the enhancement request.");
    } finally {
      setBusyHistoryId(null);
    }
  };

  const restoreRequest = async (requestId: string) => {
    setBusyHistoryId(requestId);
    setError(null);
    try {
      await client.restore(requestId);
      if (historyVisibility === "dismissed") {
        setHistory((current) => current.filter((request) => request.id !== requestId));
        setHistoryTotal((current) => Math.max(0, current - 1));
      } else {
        setHistory((current) => current.map((request) => request.id === requestId
          ? { ...request, dismissed: false, dismissed_at: null }
          : request));
      }
    } catch (caught) {
      setError(caught instanceof Error
        ? caught.message
        : "Could not restore the enhancement request.");
    } finally {
      setBusyHistoryId(null);
    }
  };

  const clearSucceeded = async () => {
    setBusyHistoryId("__succeeded__");
    setError(null);
    try {
      const result = await client.dismissSucceeded();
      if (historyVisibility === "active") {
        setHistory((current) => current.filter(
          (request) => request.status_group !== "succeeded",
        ));
        setHistoryTotal((current) => Math.max(0, current - result.dismissed_count));
      } else {
        await loadHistory(0);
      }
    } catch (caught) {
      setError(caught instanceof Error
        ? caught.message
        : "Could not clear succeeded enhancement requests.");
    } finally {
      setBusyHistoryId(null);
    }
  };

  if (!open) return null;

  const hasAskOptions = policy.run_work_request === "ask";
  const canNotify = client.notificationsEnabled !== false && notificationAvailable;
  const variables = appearanceVariables(appearance);
  const closeDialog = () => {
    if (!submitting) onClose();
  };

  const selectTab = (next: DialogTab) => setTab(next);
  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, current: DialogTab) => {
    const next = event.key === "ArrowRight" || event.key === "ArrowDown"
      ? current === "new" ? "history" : "new"
      : event.key === "ArrowLeft" || event.key === "ArrowUp"
        ? current === "history" ? "new" : "history"
        : event.key === "Home"
          ? "new"
          : event.key === "End"
            ? "history"
            : null;
    if (!next) return;
    event.preventDefault();
    setTab(next);
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => {
        const id = next === "new" ? newTabId : historyTabId;
        document.getElementById(id)?.focus();
      });
    }
  };

  const onDialogKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeDialog();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector) || [],
    ).filter((element) => element.getAttribute("aria-hidden") !== "true");
    if (focusable.length === 0) {
      event.preventDefault();
      dialogRef.current?.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const historyForm = <form onSubmit={(event) => {
    event.preventDefault();
    void loadHistory(0);
  }}>
    {(historyCapabilities?.search
      || historyCapabilities?.status_groups.length
      || historyCapabilities?.sorts.length
      || historyCapabilities?.visibilities.length) && <div style={styles.historyControls}>
      {historyCapabilities?.search && <input aria-label="Search my requests" value={historySearch} onChange={(event) => setHistorySearch(event.target.value)} placeholder="Search my requests" style={styles.input} />}
      {Boolean(historyCapabilities?.status_groups.length) && <select aria-label="Enhancement status" value={historyStatus} onChange={(event) => setHistoryStatus(event.target.value as EnhancementHistoryStatusGroup | "")} style={styles.input}>
        <option value="">All statuses</option>
        {historyCapabilities!.status_groups.map((status) => <option key={status} value={status}>{displayLabel(status)}</option>)}
      </select>}
      {Boolean(historyCapabilities?.visibilities.length) && <select aria-label="Enhancement visibility" value={historyVisibility} onChange={(event) => setHistoryVisibility(event.target.value as EnhancementHistoryVisibility)} style={styles.input}>
        {historyCapabilities!.visibilities.map((visibility) => <option key={visibility} value={visibility}>{displayLabel(visibility)}</option>)}
      </select>}
      {Boolean(historyCapabilities?.sorts.length) && <select aria-label="Enhancement sort order" value={historySort} onChange={(event) => setHistorySort(event.target.value as EnhancementHistorySort)} style={styles.input}>
        {historyCapabilities!.sorts.map((sort) => <option key={sort} value={sort}>{displayLabel(sort)}</option>)}
      </select>}
    </div>}
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
      <button type="submit" disabled={loadingHistory} style={buttonStyle("secondary")}>
        {loadingHistory ? "Loading…" : historyCapabilities ? "Apply filters" : "Refresh"}
      </button>
      {historyCapabilities?.dismiss_succeeded && <button type="button" disabled={busyHistoryId !== null} onClick={() => void clearSucceeded()} style={buttonStyle("secondary")}>
        {busyHistoryId === "__succeeded__" ? "Clearing…" : "Clear succeeded"}
      </button>}
    </div>
    <div style={{ marginBottom: 12, color: "var(--handrail-enhancement-muted-text)", fontSize: 12 }}>
      Dismiss and Clear succeeded only hide requests from your list; they do not cancel or delete the canonical request or linked Work Request.
    </div>
  </form>;

  return <div
    data-handrail-enhancement-reporter="overlay"
    data-theme={appearance?.themeMode || "auto"}
    style={{ ...styles.overlay, ...variables }}
    onMouseDown={(event) => {
      if (event.target === event.currentTarget) closeDialog();
    }}
  >
    <style>{RESPONSIVE_DIALOG_CSS}</style>
    <section
      ref={dialogRef}
      className={appearance?.className}
      data-handrail-enhancement-reporter-dialog="true"
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
      aria-describedby={descriptionId}
      aria-busy={submitting || discovering}
      tabIndex={-1}
      style={styles.dialog}
      onPaste={onPaste}
      onKeyDown={onDialogKeyDown}
    >
      <header data-handrail-enhancement-header="true" style={styles.header}>
        <div style={{ minWidth: 0 }}>
          <div style={{ marginBottom: 4, color: "var(--handrail-enhancement-accent)", fontSize: 10, fontWeight: 800, letterSpacing: "0.14em" }}>HELP US IMPROVE IT</div>
          <h2 id={headingId} style={{ margin: 0, fontSize: 22, lineHeight: 1.2, letterSpacing: "-0.02em" }}>{heading}</h2>
          <div id={descriptionId} style={{ marginTop: 4, color: "var(--handrail-enhancement-muted-text)", fontSize: 12 }}>
            Describe the improvement and review the attached context before sending.
          </div>
        </div>
        <button type="button" aria-label="Close enhancement reporter" disabled={submitting} onClick={closeDialog} style={{ ...buttonStyle("secondary"), width: 44, minWidth: 44, height: 44, padding: 0, fontSize: 22, lineHeight: 1, opacity: submitting ? 0.65 : 1 }}>×</button>
      </header>
      <div data-handrail-enhancement-content="true" style={styles.content}>
        {historyAvailable && <div role="tablist" aria-label="Enhancement reporter views" data-handrail-enhancement-tabs="true" style={styles.tabs}>
          <button id={newTabId} type="button" role="tab" aria-controls={newPanelId} aria-selected={tab === "new"} tabIndex={tab === "new" ? 0 : -1} onClick={() => selectTab("new")} onKeyDown={(event) => onTabKeyDown(event, "new")} style={{ ...styles.tab, ...(tab === "new" ? styles.activeTab : {}) }}>New request</button>
          <button id={historyTabId} type="button" role="tab" aria-controls={historyPanelId} aria-selected={tab === "history"} tabIndex={tab === "history" ? 0 : -1} onClick={() => selectTab("history")} onKeyDown={(event) => onTabKeyDown(event, "history")} style={{ ...styles.tab, ...(tab === "history" ? styles.activeTab : {}) }}>My requests</button>
        </div>}

        {error && <div role="alert" aria-live="assertive" style={{ ...styles.status, background: "var(--handrail-enhancement-danger-surface)", color: "var(--handrail-enhancement-danger-text)" }}>{error}</div>}
        {submitted && tab === "new" && <div role="status" aria-live="polite" style={{ ...styles.status, background: "var(--handrail-enhancement-success-surface)", color: "var(--handrail-enhancement-success-text)" }}>
          Request submitted successfully as <strong>{submitted.linked_work_request?.id || submitted.id}</strong>.
          {notificationNotice && <> {notificationNotice}</>}
        </div>}

        {tab === "new" ? <div id={newPanelId} role={historyAvailable ? "tabpanel" : undefined} aria-labelledby={historyAvailable ? newTabId : undefined}>
          {discovering && <div role="status" style={{ marginBottom: 12, color: "var(--handrail-enhancement-muted-text)", fontSize: 12 }}>Checking available options…</div>}
          <form onSubmit={(event) => void submit(event)}>
            <span role="status" aria-live="polite" style={styles.visuallyHidden}>
              {submitting ? "Submitting your enhancement request…" : ""}
            </span>
            <div data-handrail-enhancement-report-layout="true" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.7fr) minmax(280px, .8fr)", gap: 20, alignItems: "start" }}>
              <section aria-label="Enhancement details">
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(150px, .3fr)", gap: 12 }}>
                  <label style={styles.label}>
                    Short title
                    <input style={styles.input} maxLength={500} required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What should be improved?" />
                  </label>
                  <label style={styles.label}>
                    Priority
                    <select aria-label="Enhancement priority" style={styles.input} value={priority} onChange={(event) => setPriority(event.target.value as typeof priority)}>
                      <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option>
                    </select>
                  </label>
                </div>
                <label style={styles.label}>
                  Desired outcome
                  <textarea style={{ ...styles.input, minHeight: 112, resize: "vertical" }} maxLength={20_000} required value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe the outcome you want. You can paste screenshots here." />
                </label>
                <div
              data-handrail-enhancement-image-dropzone="true"
              onDragEnter={onImageDragOver}
              onDragOver={onImageDragOver}
              onDragLeave={() => setDragActive(false)}
              onDrop={onImageDrop}
              style={{
                ...styles.drop,
                ...(dragActive ? { borderColor: "var(--handrail-enhancement-accent)", color: "var(--handrail-enhancement-accent)" } : {}),
              }}
            >
                  <strong>Add screenshots or images</strong>
                  <div style={{ marginTop: 3, fontSize: 11 }}>Upload, paste, or drop PNG, JPEG, GIF, or WebP images. Up to 4 images, 5 MiB each and 15 MiB total.</div>
                  <label style={{ display: "inline-block", marginTop: 8, cursor: "pointer", color: "var(--handrail-enhancement-accent)", fontWeight: 700 }}>
                    Choose images
                    <input aria-label="Choose enhancement images" type="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple onChange={onFiles} style={{ display: "none" }} />
                  </label>
                  {images.length > 0 && <div style={styles.imageGrid}>{images.map((image) => <div key={image.id} style={styles.imageCard}>
                    {image.preview && <img src={image.preview} alt="" style={{ width: "100%", height: 76, objectFit: "cover", display: "block" }} />}
                    <div title={image.name} style={{ padding: "7px 26px 7px 8px", whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden", fontSize: 11 }}>{image.name}</div>
                    <button type="button" aria-label={`Remove ${image.name}`} onClick={() => removeImage(image.id)} style={{ position: "absolute", top: 4, right: 4, width: 23, height: 23, padding: 0, border: 0, borderRadius: 12, cursor: "pointer", background: "rgba(15,23,42,.78)", color: "#fff" }}>×</button>
                  </div>)}</div>}
                </div>
              </section>

              <aside data-handrail-enhancement-context="true" aria-label="Attached context and options" style={{ display: "grid", gap: 12 }}>
                <section style={{ overflow: "hidden", border: "1px solid var(--handrail-enhancement-border)", borderRadius: 12, background: "var(--handrail-enhancement-surface)" }}>
                  <h3 style={{ margin: 0, padding: "12px 14px", borderBottom: "1px solid var(--handrail-enhancement-border)", fontSize: 13 }}>Attached context</h3>
                  {([[
                    "Current page", attachedContext.route || "Not provided",
                  ], ["Page title", attachedContext.pageTitle || "Not provided"], ["App version", attachedContext.appVersion || "Not provided"], ["Viewport", attachedContext.viewport || "Not provided"]] as const).map(([label, value]) => <div key={label} style={{ display: "grid", gridTemplateColumns: "110px minmax(0, 1fr)", gap: 12, padding: "10px 14px", borderBottom: "1px solid var(--handrail-enhancement-border)", fontSize: 12 }}>
                    <span style={{ color: "var(--handrail-enhancement-muted-text)" }}>{label}</span>
                    <strong title={value} style={{ overflow: "hidden", textAlign: "right", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</strong>
                  </div>)}
                  <p style={{ margin: 0, padding: "11px 14px", color: "var(--handrail-enhancement-muted-text)", background: "var(--handrail-enhancement-surface-muted)", fontSize: 11 }}>Only context shown here is included with this request.</p>
                </section>

                {canNotify && <fieldset style={{ ...styles.fieldset, margin: 0 }}>
                  <legend style={{ padding: "0 5px", fontSize: 12, fontWeight: 700 }}>Updates</legend>
                  <label style={{ ...styles.checkboxLabel, marginTop: 0 }}>
                    <input aria-label="Email me when this enhancement is fixed" type="checkbox" checked={notifyOnResolution} onChange={(event) => setNotifyOnResolution(event.target.checked)} />
                    <span><strong>Email me when this is fixed</strong><span style={{ display: "block", marginTop: 2, color: "var(--handrail-enhancement-muted-text)", fontSize: 11 }}>One email to {notificationRecipientHint || "your Known User email"} after the fix reaches this environment.</span></span>
                  </label>
                </fieldset>}

                {hasAskOptions && <fieldset style={{ ...styles.fieldset, margin: 0 }}>
              <legend style={{ padding: "0 5px", fontSize: 12, fontWeight: 700 }}>Optional automation</legend>
              {policy.run_work_request === "ask" && <label style={{ ...styles.checkboxLabel, marginTop: 0 }}>
                <input type="checkbox" aria-label="Start work on this request" checked={automationRequests.run_work_request} onChange={(event) => setAutomationRequests((current) => ({
                  ...current,
                  run_work_request: event.target.checked,
                }))} />
                <span><strong>Start work on this request</strong><span style={{ display: "block", marginTop: 2, color: "var(--handrail-enhancement-muted-text)", fontSize: 11 }}>Otherwise it remains pending for the product team.</span></span>
              </label>}
                </fieldset>}
              </aside>
            </div>

            <div style={styles.formActions}>
              <button type="button" disabled={submitting} onClick={closeDialog} style={buttonStyle("secondary")}>Cancel</button>
              <button type="submit" disabled={submitting} style={{ ...buttonStyle("primary"), opacity: submitting ? 0.65 : 1 }}>{submitting ? "Submitting…" : "Submit enhancement"}</button>
            </div>
          </form>
        </div> : <div id={historyPanelId} role="tabpanel" aria-labelledby={historyTabId} style={{ display: "flex", minHeight: 0, flexDirection: "column" }}>
          {historyForm}
          {loadingHistory && history.length === 0 && <div role="status">Loading your enhancement requests…</div>}
          {!loadingHistory && history.length === 0 && !error && <div role="status" style={{ color: "var(--handrail-enhancement-muted-text)" }}>No enhancement requests match these filters.</div>}
          {history.length > 0 && <div role="table" aria-label="Enhancement requests" data-handrail-enhancement-history-list="true" style={styles.historyList}>
            <div role="row" data-handrail-enhancement-history-header="true" style={styles.historyListHeader}>
              <span role="columnheader">Request</span><span role="columnheader">Submitted</span><span role="columnheader">Work request</span><span role="columnheader">Status</span><span role="columnheader">Release</span><span role="columnheader">Action</span>
            </div>
            {history.map((request) => <HistoryRow
              key={request.id}
              request={request}
              busy={busyHistoryId === request.id}
              expanded={expandedRequestId === request.id}
              onToggle={(requestId) => setExpandedRequestId((current) => current === requestId ? null : requestId)}
              canRestore={historyCapabilities?.restore === true}
              onDismiss={dismissRequest}
              onRestore={restoreRequest}
            />)}
          </div>}
          <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", marginTop: 16 }}>
            {historyHasMore && <button type="button" disabled={loadingHistory} onClick={() => void loadHistory(history.length)} style={buttonStyle("secondary")}>{loadingHistory ? "Loading…" : "Show more"}</button>}
            {historyTotal > 0 && <span style={{ color: "var(--handrail-enhancement-muted-text)", fontSize: 11 }}>{history.length} of {historyTotal}</span>}
            {historySummary && <span style={{ color: "var(--handrail-enhancement-muted-text)", fontSize: 11 }}>{historySummary.succeeded} succeeded · {historySummary.in_progress} in progress · {historySummary.needs_attention} needing attention</span>}
          </div>
        </div>}
      </div>
    </section>
  </div>;
}

export function EnhancementReporterButton({
  label = "Suggest an enhancement",
  className,
  style,
  ...dialogProps
}: EnhancementReporterButtonProps): ReactElement {
  const [open, setOpen] = useState(false);
  return <>
    <button
      type="button"
      className={className}
      style={style || buttonStyle("primary")}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={() => setOpen(true)}
    >
      {label}
    </button>
    <EnhancementReporterDialog
      {...dialogProps}
      open={open}
      onClose={() => setOpen(false)}
    />
  </>;
}
