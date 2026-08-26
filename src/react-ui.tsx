import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type ClipboardEvent as ReactClipboardEvent,
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
  /** Defaults to auto, inheriting the host color scheme and typography. */
  readonly themeMode?: EnhancementReporterThemeMode;
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
  readonly deploy_staging: "never" | "ask" | "always";
  readonly deploy_production: "never" | "ask" | "always";
}

type UiVariables = CSSProperties & Record<`--handrail-enhancement-${string}`, string>;
type DialogTab = "new" | "history";

const PENDING_POLICY: EnhancementPolicyCells = Object.freeze({
  run_work_request: "pending",
  deploy_staging: "never",
  deploy_production: "never",
});

const LIGHT_TOKENS: EnhancementReporterThemeTokens = Object.freeze({
  accent: "#175cd3",
  accentText: "#ffffff",
  surface: "#ffffff",
  surfaceMuted: "#f6f8fb",
  text: "#17202e",
  mutedText: "#596579",
  border: "#d5dbe5",
  overlay: "rgba(15, 23, 42, 0.55)",
  dangerSurface: "#fff0f0",
  dangerText: "#a51d1d",
  successSurface: "#eaf8f0",
  successText: "#17623b",
  radius: "12px",
  fontFamily: "inherit",
});

const DARK_TOKENS: EnhancementReporterThemeTokens = Object.freeze({
  accent: "#78a9ff",
  accentText: "#071426",
  surface: "#161b24",
  surfaceMuted: "#202733",
  text: "#f2f4f8",
  mutedText: "#b5bdca",
  border: "#3a4352",
  overlay: "rgba(0, 0, 0, 0.72)",
  dangerSurface: "#3a1d23",
  dangerText: "#ffb4b8",
  successSurface: "#173326",
  successText: "#95ddb7",
  radius: "12px",
  fontFamily: "inherit",
});

const AUTO_TOKENS: EnhancementReporterThemeTokens = Object.freeze({
  accent: "LinkText",
  accentText: "Canvas",
  surface: "Canvas",
  surfaceMuted: "color-mix(in srgb, CanvasText 6%, Canvas)",
  text: "CanvasText",
  mutedText: "GrayText",
  border: "color-mix(in srgb, CanvasText 22%, Canvas)",
  overlay: "rgba(0, 0, 0, 0.55)",
  dangerSurface: "color-mix(in srgb, #d92d20 14%, Canvas)",
  dangerText: "#d92d20",
  successSurface: "color-mix(in srgb, #168a50 14%, Canvas)",
  successText: "#168a50",
  radius: "12px",
  fontFamily: "inherit",
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
    deploy_staging: run !== "pending" && ["never", "ask", "always"].includes(cells?.deploy_staging)
      ? cells.deploy_staging
      : "never",
    deploy_production: run !== "pending" && ["never", "ask", "always"].includes(cells?.deploy_production)
      ? cells.deploy_production
      : "never",
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
    padding: 12,
    background: "var(--handrail-enhancement-overlay)",
  },
  dialog: {
    display: "flex",
    flexDirection: "column",
    width: "min(700px, calc(100vw - 24px))",
    height: "min(720px, calc(100dvh - 24px))",
    maxHeight: "calc(100vh - 24px)",
    overflow: "hidden",
    border: "1px solid var(--handrail-enhancement-border)",
    borderRadius: "var(--handrail-enhancement-radius)",
    background: "var(--handrail-enhancement-surface)",
    color: "var(--handrail-enhancement-text)",
    boxShadow: "0 24px 70px rgba(0, 0, 0, 0.3)",
    fontFamily: "var(--handrail-enhancement-font-family)",
  },
  header: {
    display: "flex",
    flexShrink: 0,
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    padding: "18px 20px 14px",
    borderBottom: "1px solid var(--handrail-enhancement-border)",
  },
  content: { flex: 1, minHeight: 0, overflow: "auto", padding: 20 },
  tabs: {
    display: "flex",
    gap: 6,
    padding: 4,
    marginBottom: 18,
    borderRadius: 10,
    background: "var(--handrail-enhancement-surface-muted)",
  },
  tab: {
    flex: 1,
    border: "1px solid transparent",
    borderRadius: 8,
    padding: "8px 10px",
    cursor: "pointer",
    color: "inherit",
    background: "transparent",
    font: "inherit",
    fontWeight: 700,
  },
  activeTab: {
    borderColor: "var(--handrail-enhancement-border)",
    background: "var(--handrail-enhancement-surface)",
  },
  label: {
    display: "grid",
    gap: 7,
    marginBottom: 16,
    color: "inherit",
    fontSize: 13,
    fontWeight: 700,
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid var(--handrail-enhancement-border)",
    borderRadius: 9,
    padding: "10px 12px",
    color: "inherit",
    background: "var(--handrail-enhancement-surface)",
    font: "inherit",
  },
  fieldset: {
    margin: "16px 0 0",
    padding: 14,
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
    borderRadius: 11,
    padding: 14,
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
    borderRadius: 9,
    padding: "9px 14px",
    cursor: "pointer",
    font: "inherit",
    fontWeight: 700,
  },
  status: { marginBottom: 14, borderRadius: 9, padding: "10px 12px", fontSize: 13 },
  historyControls: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
    gap: 8,
    marginBottom: 12,
  },
  historyItem: {
    display: "grid",
    gap: 6,
    padding: "13px 0",
    borderBottom: "1px solid var(--handrail-enhancement-border)",
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
  canRestore,
  onDismiss,
  onRestore,
}: {
  readonly request: EnhancementRequestRecord;
  readonly busy: boolean;
  readonly canRestore: boolean;
  readonly onDismiss: (requestId: string) => Promise<void>;
  readonly onRestore: (requestId: string) => Promise<void>;
}): ReactElement {
  const release = enhancementReleaseSummary(request);
  return <article style={styles.historyItem}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
      <strong>{request.title}</strong>
      <span style={{ color: "var(--handrail-enhancement-muted-text)", fontSize: 12 }}>
        {request.status.replaceAll("_", " ")}
      </span>
    </div>
    <div style={{ color: "var(--handrail-enhancement-muted-text)", fontSize: 12 }}>
      {release.label}
    </div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
      <span style={{ color: "var(--handrail-enhancement-muted-text)", fontSize: 11 }}>
        {request.linked_work_request?.id ? `Work Request ${request.linked_work_request.id}` : request.id}
      </span>
      {request.dismissed && canRestore
        ? <button type="button" aria-label={`Restore ${request.title}`} disabled={busy} onClick={() => void onRestore(request.id)} style={{ border: 0, padding: 0, color: "var(--handrail-enhancement-accent)", background: "transparent", cursor: busy ? "wait" : "pointer", font: "inherit", fontSize: 12, textDecoration: "underline" }}>{busy ? "Restoring…" : "Restore"}</button>
        : !request.dismissed && <button type="button" aria-label={`Dismiss ${request.title}`} disabled={busy} onClick={() => void onDismiss(request.id)} style={{ border: 0, padding: 0, color: "var(--handrail-enhancement-accent)", background: "transparent", cursor: busy ? "wait" : "pointer", font: "inherit", fontSize: 12, textDecoration: "underline" }}>{busy ? "Dismissing…" : "Dismiss"}</button>}
    </div>
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
  const [notifyOnResolution, setNotifyOnResolution] = useState(false);
  const [notificationAvailable, setNotificationAvailable] = useState(false);
  const [notificationRecipientHint, setNotificationRecipientHint] = useState<string | null>(null);
  const [images, setImages] = useState<SelectedImage[]>([]);
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
    deploy_staging: false,
    deploy_production: false,
  });
  const [discovering, setDiscovering] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [busyHistoryId, setBusyHistoryId] = useState<string | null>(null);
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
      deploy_staging: false,
      deploy_production: false,
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
        images: images.map((image) => image.input),
        context: { appVersion },
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
      for (const image of images) revokePreview(image, previewUrls.current);
      setImages([]);
      setAutomationRequests({
        run_work_request: false,
        deploy_staging: false,
        deploy_production: false,
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

  const workWillStart = policy.run_work_request === "always"
    || (policy.run_work_request === "ask" && automationRequests.run_work_request);
  const hasAskOptions = policy.run_work_request === "ask"
    || policy.deploy_staging === "ask"
    || policy.deploy_production === "ask";
  const canNotify = client.notificationsEnabled !== false && notificationAvailable;
  const variables = appearanceVariables(appearance);

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
      onClose();
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
        {historyCapabilities!.status_groups.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
      </select>}
      {Boolean(historyCapabilities?.visibilities.length) && <select aria-label="Enhancement visibility" value={historyVisibility} onChange={(event) => setHistoryVisibility(event.target.value as EnhancementHistoryVisibility)} style={styles.input}>
        {historyCapabilities!.visibilities.map((visibility) => <option key={visibility} value={visibility}>{visibility}</option>)}
      </select>}
      {Boolean(historyCapabilities?.sorts.length) && <select aria-label="Enhancement sort order" value={historySort} onChange={(event) => setHistorySort(event.target.value as EnhancementHistorySort)} style={styles.input}>
        {historyCapabilities!.sorts.map((sort) => <option key={sort} value={sort}>{sort}</option>)}
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
      if (event.target === event.currentTarget) onClose();
    }}
  >
    <section
      ref={dialogRef}
      className={appearance?.className}
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
      aria-describedby={descriptionId}
      tabIndex={-1}
      style={styles.dialog}
      onPaste={onPaste}
      onKeyDown={onDialogKeyDown}
    >
      <header style={styles.header}>
        <div>
          <h2 id={headingId} style={{ margin: 0, fontSize: 20 }}>{heading}</h2>
          <div id={descriptionId} style={{ marginTop: 4, color: "var(--handrail-enhancement-muted-text)", fontSize: 12 }}>
            Requests are sent to your product team as pending work.
          </div>
        </div>
        <button type="button" aria-label="Close enhancement reporter" onClick={onClose} style={{ ...buttonStyle("secondary"), padding: "5px 10px", fontSize: 20 }}>×</button>
      </header>
      <div style={styles.content}>
        {historyAvailable && <div role="tablist" aria-label="Enhancement reporter views" style={styles.tabs}>
          <button id={newTabId} type="button" role="tab" aria-controls={newPanelId} aria-selected={tab === "new"} tabIndex={tab === "new" ? 0 : -1} onClick={() => selectTab("new")} onKeyDown={(event) => onTabKeyDown(event, "new")} style={{ ...styles.tab, ...(tab === "new" ? styles.activeTab : {}) }}>New request</button>
          <button id={historyTabId} type="button" role="tab" aria-controls={historyPanelId} aria-selected={tab === "history"} tabIndex={tab === "history" ? 0 : -1} onClick={() => selectTab("history")} onKeyDown={(event) => onTabKeyDown(event, "history")} style={{ ...styles.tab, ...(tab === "history" ? styles.activeTab : {}) }}>My requests</button>
        </div>}

        {error && <div role="alert" aria-live="assertive" style={{ ...styles.status, background: "var(--handrail-enhancement-danger-surface)", color: "var(--handrail-enhancement-danger-text)" }}>{error}</div>}
        {submitted && tab === "new" && <div role="status" aria-live="polite" style={{ ...styles.status, background: "var(--handrail-enhancement-success-surface)", color: "var(--handrail-enhancement-success-text)" }}>
          Submitted as pending Work Request <strong>{submitted.linked_work_request?.id || submitted.id}</strong>.
          {notificationNotice && <> {notificationNotice}</>}
        </div>}

        {tab === "new" ? <div id={newPanelId} role={historyAvailable ? "tabpanel" : undefined} aria-labelledby={historyAvailable ? newTabId : undefined}>
          {discovering && <div role="status" style={{ marginBottom: 12, color: "var(--handrail-enhancement-muted-text)", fontSize: 12 }}>Checking available options…</div>}
          <form onSubmit={(event) => void submit(event)}>
            <span role="status" aria-live="polite" style={styles.visuallyHidden}>
              {submitting ? "Submitting your enhancement request…" : ""}
            </span>
            <label style={styles.label}>
              Short title
              <input style={styles.input} maxLength={500} required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What should be improved?" />
            </label>
            <label style={styles.label}>
              Details
              <textarea style={{ ...styles.input, minHeight: 130, resize: "vertical" }} maxLength={20_000} required value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe the outcome you want. You can paste screenshots here." />
            </label>
            <div style={styles.drop}>
              <strong>Add screenshots or images</strong>
              <div style={{ marginTop: 4 }}>Upload files or paste from your clipboard. PNG, JPEG, GIF, or WebP; up to 4 images, 5 MiB each and 15 MiB total.</div>
              <label style={{ display: "inline-block", marginTop: 10, cursor: "pointer", color: "var(--handrail-enhancement-accent)", fontWeight: 700 }}>
                Choose images
                <input aria-label="Choose enhancement images" type="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple onChange={onFiles} style={{ display: "none" }} />
              </label>
              {images.length > 0 && <div style={styles.imageGrid}>{images.map((image) => <div key={image.id} style={styles.imageCard}>
                {image.preview && <img src={image.preview} alt="" style={{ width: "100%", height: 86, objectFit: "cover", display: "block" }} />}
                <div title={image.name} style={{ padding: "7px 26px 7px 8px", whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden", fontSize: 11 }}>{image.name}</div>
                <button type="button" aria-label={`Remove ${image.name}`} onClick={() => removeImage(image.id)} style={{ position: "absolute", top: 4, right: 4, width: 23, height: 23, padding: 0, border: 0, borderRadius: 12, cursor: "pointer", background: "rgba(15,23,42,.78)", color: "#fff" }}>×</button>
              </div>)}</div>}
            </div>

            {canNotify && <fieldset style={styles.fieldset}>
              <legend style={{ padding: "0 5px", fontSize: 12, fontWeight: 700 }}>Updates</legend>
              <label style={{ ...styles.checkboxLabel, marginTop: 0 }}>
                <input aria-label="Email me when this enhancement is fixed" type="checkbox" checked={notifyOnResolution} onChange={(event) => setNotifyOnResolution(event.target.checked)} />
                <span>
                  <strong>Email me when this is fixed</strong>
                  <span style={{ display: "block", marginTop: 2, color: "var(--handrail-enhancement-muted-text)", fontSize: 12 }}>
                    We’ll send one email to {notificationRecipientHint || "your Known User email"} after the fix is available in the environment you’re using. It includes an unsubscribe link.
                  </span>
                </span>
              </label>
            </fieldset>}

            {hasAskOptions && <fieldset style={styles.fieldset}>
              <legend style={{ padding: "0 5px", fontSize: 12, fontWeight: 700 }}>Optional automation</legend>
              {policy.run_work_request === "ask" && <label style={{ ...styles.checkboxLabel, marginTop: 0 }}>
                <input type="checkbox" aria-label="Start work on this request" checked={automationRequests.run_work_request} onChange={(event) => setAutomationRequests((current) => ({
                  ...current,
                  run_work_request: event.target.checked,
                  ...(!event.target.checked
                    ? { deploy_staging: false, deploy_production: false }
                    : {}),
                }))} />
                <span><strong>Start work on this request</strong><span style={{ display: "block", marginTop: 2, color: "var(--handrail-enhancement-muted-text)", fontSize: 12 }}>Otherwise it remains a Pending Work Request for the product team.</span></span>
              </label>}
              {policy.deploy_staging === "ask" && <label style={{ ...styles.checkboxLabel, alignItems: "center", color: workWillStart ? "inherit" : "var(--handrail-enhancement-muted-text)", cursor: workWillStart ? "pointer" : "not-allowed" }}>
                <input type="checkbox" aria-label="Deploy to staging" disabled={!workWillStart} checked={automationRequests.deploy_staging} onChange={(event) => setAutomationRequests((current) => ({ ...current, deploy_staging: event.target.checked }))} />
                <strong>Deploy to staging after implementation</strong>
              </label>}
              {policy.deploy_production === "ask" && <label style={{ ...styles.checkboxLabel, alignItems: "center", color: workWillStart ? "inherit" : "var(--handrail-enhancement-muted-text)", cursor: workWillStart ? "pointer" : "not-allowed" }}>
                <input type="checkbox" aria-label="Deploy to production" disabled={!workWillStart} checked={automationRequests.deploy_production} onChange={(event) => setAutomationRequests((current) => ({ ...current, deploy_production: event.target.checked }))} />
                <strong>Deploy to production after required validation</strong>
              </label>}
            </fieldset>}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, marginTop: 20 }}>
              <button type="button" onClick={onClose} style={buttonStyle("secondary")}>Cancel</button>
              <button type="submit" disabled={submitting} style={{ ...buttonStyle("primary"), opacity: submitting ? 0.65 : 1 }}>{submitting ? "Submitting…" : "Submit enhancement"}</button>
            </div>
          </form>
        </div> : <div id={historyPanelId} role="tabpanel" aria-labelledby={historyTabId}>
          {historyForm}
          {loadingHistory && history.length === 0 && <div role="status">Loading your enhancement requests…</div>}
          {!loadingHistory && history.length === 0 && !error && <div role="status" style={{ color: "var(--handrail-enhancement-muted-text)" }}>No enhancement requests match these filters.</div>}
          {history.map((request) => <HistoryRow
            key={request.id}
            request={request}
            busy={busyHistoryId === request.id}
            canRestore={historyCapabilities?.restore === true}
            onDismiss={dismissRequest}
            onRestore={restoreRequest}
          />)}
          <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", marginTop: 16 }}>
            {historyHasMore && <button type="button" disabled={loadingHistory} onClick={() => void loadHistory(history.length)} style={buttonStyle("secondary")}>{loadingHistory ? "Loading…" : "Show more"}</button>}
            {historyTotal > 0 && <span style={{ color: "var(--handrail-enhancement-muted-text)", fontSize: 11 }}>{history.length} of {historyTotal}</span>}
            {historySummary && <span style={{ color: "var(--handrail-enhancement-muted-text)", fontSize: 11 }}>{historySummary.succeeded} succeeded · {historySummary.in_progress} in progress · {historySummary.needs_attention} need attention</span>}
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
