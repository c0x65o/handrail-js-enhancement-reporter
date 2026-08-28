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
  readonly warningSurface: string;
  readonly warningText: string;
  readonly infoSurface: string;
  readonly infoText: string;
  readonly radius: string;
  readonly fontFamily: string;
}

export type EnhancementReporterCssVariable =
  | "--handrail-enhancement-accent"
  | "--handrail-enhancement-accent-text"
  | "--handrail-enhancement-surface"
  | "--handrail-enhancement-surface-muted"
  | "--handrail-enhancement-text"
  | "--handrail-enhancement-muted-text"
  | "--handrail-enhancement-border"
  | "--handrail-enhancement-overlay"
  | "--handrail-enhancement-danger-surface"
  | "--handrail-enhancement-danger-text"
  | "--handrail-enhancement-success-surface"
  | "--handrail-enhancement-success-text"
  | "--handrail-enhancement-warning-surface"
  | "--handrail-enhancement-warning-text"
  | "--handrail-enhancement-info-surface"
  | "--handrail-enhancement-info-text"
  | "--handrail-enhancement-radius"
  | "--handrail-enhancement-font-family";

export type EnhancementReporterStyle = CSSProperties
  & Partial<Record<EnhancementReporterCssVariable, string | number>>;

export interface EnhancementReporterAppearance {
  /**
   * Defaults to auto, following the host CSS color scheme with polished SDK defaults.
   * Apps with their own saved theme should pass the current light/dark value and
   * re-render when it changes.
   */
  readonly themeMode?: EnhancementReporterThemeMode;
  /** Overrides individual packaged-UI design tokens without changing behavior. */
  readonly tokens?: Partial<EnhancementReporterThemeTokens>;
  /** Applied to the dialog element. */
  readonly className?: string;
  /** Applied to the overlay alongside scoped design-token variables. */
  readonly style?: EnhancementReporterStyle;
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

type UiVariables = EnhancementReporterStyle;
type DialogTab = "new" | "history";

const RESPONSIVE_DIALOG_CSS = `
[data-handrail-enhancement-reporter-dialog="true"] button {
  appearance: none;
  -webkit-appearance: none;
}
[data-handrail-enhancement-reporter-dialog="true"] :is(button, input, select, textarea):focus-visible {
  outline: 2px solid var(--handrail-enhancement-accent) !important;
  outline-offset: 2px;
}
@media (max-width: 1100px) {
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
@media (max-width: 860px) {
  [data-handrail-enhancement-report-layout="true"] { grid-template-columns: minmax(0, 1fr) !important; }
  [data-handrail-enhancement-context="true"] { order: -1; }
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
  [data-handrail-enhancement-content="new"] { padding: 12px 14px !important; }
  [data-handrail-enhancement-content="history"] { padding: 12px 14px 0 !important; }
  [data-handrail-enhancement-history-list="true"] { min-height: 150px !important; }
  [data-handrail-enhancement-tabs="true"] { margin-bottom: 14px !important; }
}
`;

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
  warningSurface: "#fff8eb",
  warningText: "#b54708",
  infoSurface: "#eff6ff",
  infoText: "#175cd3",
  radius: "12px",
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
  warningSurface: "#3b2d16",
  warningText: "#fbc46d",
  infoSurface: "#172d4d",
  infoText: "#a7c7ff",
  radius: "12px",
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
  warningSurface: "light-dark(#fff8eb, #3b2d16)",
  warningText: "light-dark(#b54708, #fbc46d)",
  infoSurface: "light-dark(#eff6ff, #172d4d)",
  infoText: "light-dark(#175cd3, #a7c7ff)",
  radius: "12px",
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

function appearanceVariables(
  appearance: EnhancementReporterAppearance | undefined,
  includeIntegrationStyle = true,
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
    "--handrail-enhancement-warning-surface": tokens.warningSurface,
    "--handrail-enhancement-warning-text": tokens.warningText,
    "--handrail-enhancement-info-surface": tokens.infoSurface,
    "--handrail-enhancement-info-text": tokens.infoText,
    "--handrail-enhancement-radius": tokens.radius,
    "--handrail-enhancement-font-family": tokens.fontFamily,
    colorScheme: mode === "auto" ? "inherit" : mode,
    ...(includeIntegrationStyle ? appearance?.style : undefined),
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
    padding: 8,
    background: "var(--handrail-enhancement-overlay)",
    backdropFilter: "blur(3px)",
  },
  dialog: {
    display: "flex",
    flexDirection: "column",
    width: "min(1560px, calc(100vw - 24px))",
    height: "min(720px, calc(100dvh - 16px))",
    maxHeight: "calc(100vh - 16px)",
    boxSizing: "border-box",
    overflow: "hidden",
    border: "1px solid var(--handrail-enhancement-border)",
    borderRadius: "var(--handrail-enhancement-radius)",
    background: "var(--handrail-enhancement-surface)",
    color: "var(--handrail-enhancement-text)",
    boxShadow: "0 30px 90px rgba(0, 0, 0, 0.34)",
    fontFamily: "var(--handrail-enhancement-font-family)",
    fontSize: 13,
    lineHeight: 1.4,
    isolation: "isolate",
  },
  header: {
    display: "flex",
    flexShrink: 0,
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    padding: "14px 24px 12px",
    borderBottom: "1px solid var(--handrail-enhancement-border)",
  },
  content: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minHeight: 0,
    overflow: "auto",
    padding: "12px 20px",
    background: "var(--handrail-enhancement-surface)",
  },
  historyContent: {
    gap: 10,
    overflow: "hidden",
    padding: "10px 20px 0",
  },
  tabs: {
    display: "flex",
    gap: 8,
    padding: 0,
    marginBottom: 12,
    border: 0,
    borderRadius: 10,
    background: "transparent",
  },
  tab: {
    flex: 1,
    border: "1px solid var(--handrail-enhancement-border)",
    borderRadius: 8,
    padding: "7px 12px",
    cursor: "pointer",
    color: "var(--handrail-enhancement-muted-text)",
    background: "var(--handrail-enhancement-surface)",
    font: "inherit",
    fontWeight: 700,
    minHeight: 36,
  },
  activeTab: {
    borderColor: "var(--handrail-enhancement-accent)",
    color: "var(--handrail-enhancement-accent-text)",
    background: "var(--handrail-enhancement-accent)",
    boxShadow: "0 1px 2px color-mix(in srgb, var(--handrail-enhancement-accent) 24%, transparent)",
  },
  selectedControl: {
    borderColor: "color-mix(in srgb, var(--handrail-enhancement-accent) 32%, var(--handrail-enhancement-border))",
    color: "var(--handrail-enhancement-accent)",
    background: "color-mix(in srgb, var(--handrail-enhancement-accent) 8%, var(--handrail-enhancement-surface))",
  },
  label: {
    display: "grid",
    gap: 5,
    marginBottom: 9,
    color: "inherit",
    fontSize: 13,
    fontWeight: 700,
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid var(--handrail-enhancement-border)",
    borderRadius: 8,
    padding: "7px 10px",
    color: "inherit",
    background: "var(--handrail-enhancement-surface)",
    font: "inherit",
    minHeight: 36,
    outlineOffset: 2,
  },
  fieldset: {
    margin: "9px 0 0",
    padding: 10,
    border: "1px solid var(--handrail-enhancement-border)",
    borderRadius: 9,
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
    borderRadius: 9,
    padding: 10,
    background: "var(--handrail-enhancement-surface-muted)",
    fontSize: 13,
    color: "var(--handrail-enhancement-muted-text)",
  },
  imageGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
    gap: 8,
    marginTop: 9,
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
    borderRadius: 8,
    padding: "6px 12px",
    cursor: "pointer",
    font: "inherit",
    fontWeight: 700,
    minHeight: 34,
    outlineOffset: 2,
  },
  status: { marginBottom: 10, borderRadius: 8, padding: "9px 12px", fontSize: 12 },
  historyControls: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  historyItem: {
    display: "grid",
    gridTemplateColumns: "minmax(220px, 2.2fr) minmax(90px, .72fr) minmax(120px, .9fr) minmax(150px, 1.1fr) minmax(115px, .8fr) 126px",
    alignItems: "center",
    gap: 10,
    padding: "8px 12px",
    borderBottom: "1px solid var(--handrail-enhancement-border)",
    background: "var(--handrail-enhancement-surface)",
  },
  historyList: {
    minHeight: 0,
    overflow: "hidden auto",
    border: "1px solid var(--handrail-enhancement-border)",
    borderRadius: 10,
    background: "var(--handrail-enhancement-surface-muted)",
  },
  historyListHeader: {
    display: "grid",
    gridTemplateColumns: "minmax(220px, 2.2fr) minmax(90px, .72fr) minmax(120px, .9fr) minmax(150px, 1.1fr) minmax(115px, .8fr) 126px",
    gap: 10,
    padding: "7px 12px",
    color: "var(--handrail-enhancement-muted-text)",
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  },
  historyFooter: {
    display: "flex",
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "space-between",
    gap: 9,
    flexWrap: "wrap",
    margin: "auto -20px 0",
    padding: "9px 20px",
    borderTop: "1px solid var(--handrail-enhancement-border)",
    background: "var(--handrail-enhancement-surface)",
  },
  formActions: {
    position: "sticky",
    bottom: -16,
    zIndex: 2,
    display: "flex",
    justifyContent: "flex-end",
    gap: 9,
    flexWrap: "wrap",
    margin: "12px -20px -12px",
    padding: "9px 20px",
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

function enhancementStatusStyle(group: EnhancementHistoryStatusGroup): CSSProperties {
  if (group === "needs_attention") {
    return {
      color: "var(--handrail-enhancement-danger-text)",
      borderColor: "color-mix(in srgb, var(--handrail-enhancement-danger-text) 28%, transparent)",
      background: "var(--handrail-enhancement-danger-surface)",
    };
  }
  if (group === "succeeded") {
    return {
      color: "var(--handrail-enhancement-success-text)",
      borderColor: "color-mix(in srgb, var(--handrail-enhancement-success-text) 28%, transparent)",
      background: "var(--handrail-enhancement-success-surface)",
    };
  }
  if (group === "in_progress") {
    return {
      color: "var(--handrail-enhancement-info-text)",
      borderColor: "color-mix(in srgb, var(--handrail-enhancement-info-text) 28%, transparent)",
      background: "var(--handrail-enhancement-info-surface)",
    };
  }
  return {
    color: "var(--handrail-enhancement-muted-text)",
    borderColor: "var(--handrail-enhancement-border)",
    background: "var(--handrail-enhancement-surface-muted)",
  };
}

function releaseStyle(state: ReturnType<typeof enhancementReleaseSummary>["state"]): CSSProperties {
  if (state === "deployed") return { color: "var(--handrail-enhancement-success-text)" };
  if (state === "partially_deployed" || state === "not_deployed") {
    return { color: "var(--handrail-enhancement-warning-text)" };
  }
  return { color: "var(--handrail-enhancement-muted-text)" };
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

function decrementHistorySummary(
  summary: EnhancementHistorySummary | null,
  statusGroup: EnhancementHistoryStatusGroup,
): EnhancementHistorySummary | null {
  if (!summary) return null;
  return {
    ...summary,
    total: Math.max(0, summary.total - 1),
    [statusGroup]: Math.max(0, summary[statusGroup] - 1),
  };
}

function HistoryRow({
  request,
  busy,
  expanded,
  onToggle,
  canRestore,
  onArchive,
  onRestore,
}: {
  readonly request: EnhancementRequestRecord;
  readonly busy: boolean;
  readonly expanded: boolean;
  readonly onToggle: (requestId: string) => void;
  readonly canRestore: boolean;
  readonly onArchive: (requestId: string) => Promise<void>;
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
      <span style={{ display: "inline-block", overflow: "hidden", maxWidth: "100%", padding: "3px 8px", border: "1px solid", borderRadius: 999, textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 10, fontWeight: 800, ...enhancementStatusStyle(request.status_group) }}>{displayLabel(request.status)}</span>
    </div>
    <span role="cell" data-handrail-enhancement-history-cell="secondary" style={{ fontSize: 11, ...releaseStyle(release.state) }}>{release.label}</span>
    <div role="cell" data-handrail-enhancement-history-cell="action" style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
      <button type="button" aria-expanded={expanded} aria-label={`View ${request.title}`} onClick={() => onToggle(request.id)} style={{ border: 0, padding: "6px 2px", color: "var(--handrail-enhancement-accent)", background: "transparent", cursor: "pointer", font: "inherit", fontSize: 12, fontWeight: 800 }}>View</button>
      {request.dismissed && canRestore
        ? <button type="button" aria-label={`Restore ${request.title}`} disabled={busy} onClick={() => void onRestore(request.id)} style={{ border: 0, padding: "6px 2px", color: "var(--handrail-enhancement-accent)", background: "transparent", cursor: busy ? "wait" : "pointer", font: "inherit", fontSize: 12, fontWeight: 800 }}>{busy ? "Restoring…" : "Restore"}</button>
        : !request.dismissed && <button type="button" aria-label={`Archive ${request.title}`} disabled={busy} onClick={() => void onArchive(request.id)} style={{ border: 0, padding: "6px 2px", color: "var(--handrail-enhancement-accent)", background: "transparent", cursor: busy ? "wait" : "pointer", font: "inherit", fontSize: 12, fontWeight: 800 }}>{busy ? "Archiving…" : "Archive"}</button>}
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
  const [historyFiltersVisible, setHistoryFiltersVisible] = useState(true);
  const [discovering, setDiscovering] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [busyHistoryId, setBusyHistoryId] = useState<string | null>(null);
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<EnhancementRequestRecord | null>(null);
  const [notificationNotice, setNotificationNotice] = useState<string | null>(null);
  const previewUrls = useRef(new Set<string>());
  const historySearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    if (historySearchTimerRef.current !== null) clearTimeout(historySearchTimerRef.current);
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
      setNotifyOnResolution(false);
    } catch (caught) {
      setError(caught instanceof Error
        ? caught.message
        : "Could not submit the enhancement request.");
    } finally {
      setSubmitting(false);
    }
  };

  const archiveRequest = async (requestId: string) => {
    const request = history.find((candidate) => candidate.id === requestId);
    const query = currentHistoryQuery();
    setBusyHistoryId(requestId);
    setError(null);
    try {
      await client.dismiss(requestId);
      if (historyVisibility === "active") {
        setHistory((current) => current.filter((request) => request.id !== requestId));
        setHistoryTotal((current) => Math.max(0, current - 1));
        if (request) {
          setHistorySummary((current) => decrementHistorySummary(current, request.status_group));
        }
      } else {
        setHistory((current) => current.map((request) => request.id === requestId
          ? { ...request, dismissed: true }
          : request));
      }
      await loadHistory(0, query);
    } catch (caught) {
      setError(caught instanceof Error
        ? caught.message
        : "Could not archive the enhancement request.");
    } finally {
      setBusyHistoryId(null);
    }
  };

  const restoreRequest = async (requestId: string) => {
    const request = history.find((candidate) => candidate.id === requestId);
    const query = currentHistoryQuery();
    setBusyHistoryId(requestId);
    setError(null);
    try {
      await client.restore(requestId);
      if (historyVisibility === "dismissed") {
        setHistory((current) => current.filter((request) => request.id !== requestId));
        setHistoryTotal((current) => Math.max(0, current - 1));
        if (request) {
          setHistorySummary((current) => decrementHistorySummary(current, request.status_group));
        }
      } else {
        setHistory((current) => current.map((request) => request.id === requestId
          ? { ...request, dismissed: false, dismissed_at: null }
          : request));
      }
      await loadHistory(0, query);
    } catch (caught) {
      setError(caught instanceof Error
        ? caught.message
        : "Could not restore the enhancement request.");
    } finally {
      setBusyHistoryId(null);
    }
  };

  if (!open) return null;

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

  const historyCountFor = (status: EnhancementHistoryStatusGroup | ""): number => {
    if (!status) return historySummary?.total ?? historyTotal;
    return historySummary?.[status] ?? history.filter((request) => request.status_group === status).length;
  };
  const chooseHistoryVisibility = (next: EnhancementHistoryVisibility) => {
    setHistoryVisibility(next);
    void loadHistory(0, { ...currentHistoryQuery(), visibility: next });
  };
  const chooseHistoryStatus = (next: EnhancementHistoryStatusGroup | "") => {
    setHistoryStatus(next);
    void loadHistory(0, { ...currentHistoryQuery(), statusGroup: next || undefined });
  };
  const searchHistory = (next: string) => {
    setHistorySearch(next);
    if (historySearchTimerRef.current !== null) clearTimeout(historySearchTimerRef.current);
    historySearchTimerRef.current = setTimeout(() => {
      historySearchTimerRef.current = null;
      void loadHistory(0, { ...currentHistoryQuery(), search: next.trim() || undefined });
    }, 300);
  };

  const historyForm = <form onSubmit={(event) => {
    event.preventDefault();
    void loadHistory(0);
  }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, color: "var(--handrail-enhancement-muted-text)", fontSize: 12 }}>
        <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 999, background: "var(--handrail-enhancement-danger-text)" }} />
        <strong style={{ color: "var(--handrail-enhancement-text)" }}>{historySummary?.needs_attention ?? historyCountFor("needs_attention")}</strong> need attention
        <span aria-hidden="true" style={{ width: 1, height: 16, margin: "0 4px", background: "var(--handrail-enhancement-border)" }} />
        <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 999, background: "var(--handrail-enhancement-info-text)" }} />
        <strong style={{ color: "var(--handrail-enhancement-text)" }}>{historySummary?.in_progress ?? historyCountFor("in_progress")}</strong> in progress
      </div>
      <span style={{ color: "var(--handrail-enhancement-muted-text)", fontSize: 11 }}>{loadingHistory ? "Updating…" : history.length ? "Updated just now" : ""}</span>
    </div>

    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
      {Boolean(historyCapabilities?.visibilities.length) && <div role="group" aria-label="Enhancement visibility" style={{ display: "flex", gap: 2, padding: 2, border: "1px solid var(--handrail-enhancement-border)", borderRadius: 9, background: "var(--handrail-enhancement-surface-muted)" }}>
        {historyCapabilities!.visibilities.map((visibility) => <button
          key={visibility}
          type="button"
          aria-pressed={historyVisibility === visibility}
          disabled={loadingHistory || busyHistoryId !== null}
          onClick={() => chooseHistoryVisibility(visibility)}
          style={{ ...styles.tab, flex: "0 0 auto", minHeight: 32, padding: "5px 12px", ...(historyVisibility === visibility ? styles.selectedControl : {}) }}
        >{visibility === "dismissed" ? "Archived" : displayLabel(visibility)}</button>)}
      </div>}
    </div>

    {(historyCapabilities?.search || historyCapabilities?.status_groups.length || historyCapabilities?.sorts.length) && <div style={styles.historyControls}>
      {historyCapabilities?.search && <input aria-label="Search my requests" autoComplete="off" maxLength={200} type="search" value={historySearch} onChange={(event) => searchHistory(event.target.value)} placeholder="Search title, request, or release…" style={{ ...styles.input, flex: "1 1 320px", minWidth: 0 }} />}
      {Boolean(historyCapabilities?.status_groups.length) && <button type="button" aria-expanded={historyFiltersVisible} onClick={() => setHistoryFiltersVisible((current) => !current)} style={{ ...buttonStyle("secondary"), flex: "0 0 auto", ...(historyFiltersVisible ? styles.selectedControl : {}) }}>Filters</button>}
      {Boolean(historyCapabilities?.sorts.length) && <select aria-label="Enhancement sort order" value={historySort} onChange={(event) => {
        const next = event.target.value as EnhancementHistorySort;
        setHistorySort(next);
        void loadHistory(0, { ...currentHistoryQuery(), sort: next });
      }} style={{ ...styles.input, width: 140, flex: "0 1 140px" }}>
        {historyCapabilities!.sorts.map((sort) => <option key={sort} value={sort}>{sort === "newest" ? "Newest" : "Oldest"}</option>)}
      </select>}
    </div>}

    {historyFiltersVisible && Boolean(historyCapabilities?.status_groups.length) && <div role="group" aria-label="Enhancement status" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
      {(["", ...historyCapabilities!.status_groups] as const).map((status) => <button
        key={status || "all"}
        type="button"
        aria-pressed={historyStatus === status}
        onClick={() => chooseHistoryStatus(status)}
        style={{ ...buttonStyle("secondary"), minHeight: 30, padding: "4px 11px", borderRadius: 999, ...(historyStatus === status ? styles.activeTab : {}) }}
      >{status ? displayLabel(status) : "All"} <span style={{ opacity: 0.75 }}>{historyCountFor(status)}</span></button>)}
    </div>}
    <div style={{ marginBottom: 8, color: "var(--handrail-enhancement-muted-text)", fontSize: 10 }}>
      Archive only hides a request from your list; it does not cancel or delete the enhancement or any later implementation work.
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
          <h2 id={headingId} style={{ margin: 0, fontSize: 20, lineHeight: 1.2, letterSpacing: "-0.02em" }}>{heading}</h2>
          <div id={descriptionId} style={{ marginTop: 4, color: "var(--handrail-enhancement-muted-text)", fontSize: 12 }}>
            Describe the improvement and review the attached context before sending.
          </div>
        </div>
        <button type="button" aria-label="Close enhancement reporter" disabled={submitting} onClick={closeDialog} style={{ ...buttonStyle("secondary"), width: 38, minWidth: 38, height: 38, padding: 0, fontSize: 20, lineHeight: 1, opacity: submitting ? 0.65 : 1 }}>×</button>
      </header>
      <div data-handrail-enhancement-content={tab} style={{ ...styles.content, ...(tab === "history" ? styles.historyContent : {}) }}>
        {historyAvailable && <div role="tablist" aria-label="Enhancement reporter views" data-handrail-enhancement-tabs="true" style={styles.tabs}>
          <button id={newTabId} type="button" role="tab" aria-controls={newPanelId} aria-selected={tab === "new"} tabIndex={tab === "new" ? 0 : -1} onClick={() => selectTab("new")} onKeyDown={(event) => onTabKeyDown(event, "new")} style={{ ...styles.tab, ...(tab === "new" ? styles.activeTab : {}) }}>New request</button>
          <button id={historyTabId} type="button" role="tab" aria-controls={historyPanelId} aria-selected={tab === "history"} tabIndex={tab === "history" ? 0 : -1} onClick={() => selectTab("history")} onKeyDown={(event) => onTabKeyDown(event, "history")} style={{ ...styles.tab, ...(tab === "history" ? styles.activeTab : {}) }}>My requests{historyTotal > 0 && <span aria-label={`${historyTotal} total`} style={{ display: "inline-grid", placeItems: "center", minWidth: 22, height: 22, marginLeft: 8, padding: "0 6px", borderRadius: 999, color: tab === "history" ? "var(--handrail-enhancement-accent-text)" : "var(--handrail-enhancement-muted-text)", background: tab === "history" ? "color-mix(in srgb, var(--handrail-enhancement-accent-text) 18%, transparent)" : "var(--handrail-enhancement-surface-muted)", fontSize: 11 }}>{historyTotal}</span>}</button>
        </div>}

        {error && <div role="alert" aria-live="assertive" style={{ ...styles.status, background: "var(--handrail-enhancement-danger-surface)", color: "var(--handrail-enhancement-danger-text)" }}>{error}</div>}
        {submitted && tab === "new" && <div role="status" aria-live="polite" style={{ ...styles.status, background: "var(--handrail-enhancement-success-surface)", color: "var(--handrail-enhancement-success-text)" }}>
          Request submitted successfully as <strong>{submitted.linked_work_request?.id || submitted.id}</strong>.
          {notificationNotice && <> {notificationNotice}</>}
        </div>}

        {tab === "new" ? <div id={newPanelId} role={historyAvailable ? "tabpanel" : undefined} aria-labelledby={historyAvailable ? newTabId : undefined} style={{ flex: "1 0 auto" }}>
          {discovering && <div role="status" style={{ marginBottom: 12, color: "var(--handrail-enhancement-muted-text)", fontSize: 12 }}>Checking available options…</div>}
          <form onSubmit={(event) => void submit(event)}>
            <span role="status" aria-live="polite" style={styles.visuallyHidden}>
              {submitting ? "Submitting your enhancement request…" : ""}
            </span>
            <div data-handrail-enhancement-report-layout="true" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.8fr) minmax(280px, .72fr)", gap: 16, alignItems: "start" }}>
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
                  <textarea style={{ ...styles.input, minHeight: 96, resize: "vertical" }} maxLength={20_000} required value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe the outcome you want. You can paste screenshots here." />
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

              <aside data-handrail-enhancement-context="true" aria-label="Attached context and options" style={{ display: "grid", gap: 10 }}>
                <section style={{ overflow: "hidden", border: "1px solid var(--handrail-enhancement-border)", borderRadius: 9, background: "var(--handrail-enhancement-surface)" }}>
                  <h3 style={{ margin: 0, padding: "9px 12px", borderBottom: "1px solid var(--handrail-enhancement-border)", fontSize: 12 }}>Attached context</h3>
                  {([[
                    "Current page", attachedContext.route || "Not provided",
                  ], ["Page title", attachedContext.pageTitle || "Not provided"], ["App version", attachedContext.appVersion || "Not provided"], ["Viewport", attachedContext.viewport || "Not provided"]] as const).map(([label, value]) => <div key={label} style={{ display: "grid", gridTemplateColumns: "100px minmax(0, 1fr)", gap: 10, padding: "8px 12px", borderBottom: "1px solid var(--handrail-enhancement-border)", fontSize: 11 }}>
                    <span style={{ color: "var(--handrail-enhancement-muted-text)" }}>{label}</span>
                    <strong title={value} style={{ overflow: "hidden", textAlign: "right", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</strong>
                  </div>)}
                  <p style={{ margin: 0, padding: "8px 12px", color: "var(--handrail-enhancement-muted-text)", background: "var(--handrail-enhancement-surface-muted)", fontSize: 10 }}>Only context shown here is included with this request.</p>
                </section>

                {canNotify && <fieldset style={{ ...styles.fieldset, margin: 0 }}>
                  <legend style={{ padding: "0 5px", fontSize: 12, fontWeight: 700 }}>Updates</legend>
                  <label style={{ ...styles.checkboxLabel, marginTop: 0 }}>
                    <input aria-label="Email me when this enhancement is fixed" type="checkbox" checked={notifyOnResolution} onChange={(event) => setNotifyOnResolution(event.target.checked)} />
                    <span><strong>Email me when this is fixed</strong><span style={{ display: "block", marginTop: 2, color: "var(--handrail-enhancement-muted-text)", fontSize: 11 }}>One email to {notificationRecipientHint || "your Known User email"} after the fix reaches this environment.</span></span>
                  </label>
                </fieldset>}

              </aside>
            </div>

            <div style={styles.formActions}>
              <button type="button" disabled={submitting} onClick={closeDialog} style={buttonStyle("secondary")}>Cancel</button>
              <button type="submit" disabled={submitting} style={{ ...buttonStyle("primary"), opacity: submitting ? 0.65 : 1 }}>{submitting ? "Submitting…" : "Submit enhancement"}</button>
            </div>
          </form>
        </div> : <div id={historyPanelId} role="tabpanel" aria-labelledby={historyTabId} style={{ display: "flex", width: "100%", minHeight: 0, flex: "1 1 auto", flexDirection: "column" }}>
          {historyForm}
          {loadingHistory && history.length === 0 && <div role="status">Loading your enhancement requests…</div>}
          {!loadingHistory && history.length === 0 && !error && <div role="status" style={{ color: "var(--handrail-enhancement-muted-text)" }}>No enhancement requests match these filters.</div>}
          {history.length > 0 && <div role="table" aria-label="Enhancement requests" data-handrail-enhancement-history-list="true" style={{ ...styles.historyList, flex: "1 1 auto" }}>
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
              onArchive={archiveRequest}
              onRestore={restoreRequest}
            />)}
          </div>}
          <div style={styles.historyFooter}>
            <span style={{ color: "var(--handrail-enhancement-muted-text)", fontSize: 11 }}>Showing {history.length} of {historyTotal} request{historyTotal === 1 ? "" : "s"}</span>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
              {historySummary && <span style={{ color: "var(--handrail-enhancement-muted-text)", fontSize: 10 }}>{historySummary.succeeded} succeeded · {historySummary.in_progress} in progress · {historySummary.needs_attention} need attention</span>}
              {historyHasMore && <button type="button" disabled={loadingHistory} onClick={() => void loadHistory(history.length)} style={buttonStyle("secondary")}>{loadingHistory ? "Loading…" : "Show more"}</button>}
              <button type="button" onClick={closeDialog} style={buttonStyle("primary")}>Close</button>
            </div>
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
      style={style || { ...appearanceVariables(dialogProps.appearance, false), ...buttonStyle("primary") }}
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
