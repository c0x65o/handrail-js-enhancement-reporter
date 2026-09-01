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
  type EnhancementAutomationRole,
  type EnhancementDeliveryMilestone,
  type EnhancementImageInput,
  type EnhancementPriority,
  type EnhancementReporterClient,
  type EnhancementReporterPolicy,
  type EnhancementRequestRecord,
  type EnhancementSubmissionResult,
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

interface PreviewableImage {
  readonly id: string;
  readonly name: string;
  readonly url: string;
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
  [data-handrail-enhancement-history-cell="journey"] { grid-column: 1 / -1; }
}
@media (max-width: 860px) {
  [data-handrail-enhancement-report-panel="true"],
  [data-handrail-enhancement-report-form="true"] {
    display: block !important;
    flex: none !important;
    min-height: auto !important;
  }
  [data-handrail-enhancement-report-layout="true"] {
    flex: none !important;
    min-height: auto !important;
    grid-template-columns: minmax(0, 1fr) !important;
  }
  [data-handrail-enhancement-report-details="true"] {
    display: block !important;
    min-height: auto !important;
  }
  [data-handrail-enhancement-expanding-field="true"] textarea {
    height: auto !important;
  }
  [data-handrail-enhancement-context="true"] { order: -1; }
  [data-handrail-enhancement-history-overview="true"] { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
  [data-handrail-enhancement-history-detail="true"] { grid-template-columns: minmax(0, 1fr) !important; }
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

const HISTORY_REFRESH_INTERVAL_MS = 15_000;

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
    gap: 12,
    alignItems: "flex-start",
    marginTop: 10,
    padding: "3px 2px 4px",
    color: "inherit",
    fontSize: 13,
    lineHeight: 1.35,
    cursor: "pointer",
  },
  checkboxInput: {
    width: 20,
    height: 20,
    minWidth: 20,
    margin: 0,
    flex: "0 0 20px",
    accentColor: "var(--handrail-enhancement-accent)",
    cursor: "pointer",
  },
  drop: {
    display: "flex",
    flexDirection: "column",
    minHeight: 132,
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
  imagePreviewButton: {
    position: "relative",
    display: "block",
    width: "100%",
    margin: 0,
    padding: 0,
    border: 0,
    overflow: "hidden",
    background: "transparent",
    cursor: "zoom-in",
    font: "inherit",
  },
  imageLightbox: {
    position: "fixed",
    inset: 0,
    zIndex: 20,
    display: "grid",
    placeItems: "center",
    boxSizing: "border-box",
    padding: 56,
    background: "var(--handrail-enhancement-overlay)",
    backdropFilter: "blur(3px)",
  },
  imageLightboxPanel: {
    display: "grid",
    width: "min(1200px, calc(100vw - 48px))",
    maxHeight: "calc(100dvh - 88px)",
    boxSizing: "border-box",
    gap: 10,
    margin: 0,
    padding: 10,
    border: "1px solid var(--handrail-enhancement-border)",
    borderRadius: 12,
    color: "var(--handrail-enhancement-text)",
    background: "var(--handrail-enhancement-surface)",
    boxShadow: "0 24px 80px rgba(0, 0, 0, 0.4)",
  },
  imageLightboxImage: {
    display: "block",
    maxWidth: "100%",
    maxHeight: "calc(100dvh - 164px)",
    justifySelf: "center",
    border: "1px solid var(--handrail-enhancement-border)",
    borderRadius: 10,
    objectFit: "contain",
    background: "var(--handrail-enhancement-surface-muted)",
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
    gridTemplateColumns: "minmax(190px, 1.45fr) minmax(420px, 3.4fr) minmax(150px, 1fr) minmax(140px, .9fr) 112px",
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
    gridTemplateColumns: "minmax(190px, 1.45fr) minmax(420px, 3.4fr) minmax(150px, 1fr) minmax(140px, .9fr) 112px",
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

function ImageLightbox({
  images,
  activeIndex,
  source,
  onActiveIndexChange,
  onClose,
}: {
  readonly images: readonly PreviewableImage[];
  readonly activeIndex: number;
  readonly source: "selection" | "history";
  readonly onActiveIndexChange: (index: number) => void;
  readonly onClose: () => void;
}): ReactElement | null {
  const activeImage = images[activeIndex];
  if (!activeImage) return null;
  const hasPrevious = activeIndex > 0;
  const hasNext = activeIndex < images.length - 1;
  const move = (direction: -1 | 1) => {
    const nextIndex = activeIndex + direction;
    if (nextIndex < 0 || nextIndex >= images.length) return;
    onActiveIndexChange(nextIndex);
  };
  return <section
    data-handrail-enhancement-image-lightbox="true"
    data-handrail-enhancement-image-lightbox-source={source}
    role="dialog"
    aria-modal="true"
    aria-label={`Preview of ${activeImage.name}`}
    tabIndex={-1}
    onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}
    onKeyDown={(event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        const direction = event.key === "ArrowLeft" ? -1 : 1;
        const canMove = direction === -1 ? hasPrevious : hasNext;
        if (canMove) {
          event.preventDefault();
          onActiveIndexChange(activeIndex + direction);
        }
        event.stopPropagation();
        return;
      }
      if (event.key !== "Tab") return;
      event.stopPropagation();
      const focusable = Array.from(
        event.currentTarget.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter((element) => !element.hasAttribute("disabled"));
      if (focusable.length === 0) {
        event.preventDefault();
        event.currentTarget.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = typeof document === "undefined" ? null : document.activeElement;
      if (event.shiftKey && activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }}
    style={styles.imageLightbox}
  >
    <button
      type="button"
      aria-label="Close image preview"
      autoFocus
      onClick={onClose}
      style={{ ...buttonStyle("secondary"), position: "absolute", top: 16, right: 16, width: 40, height: 40, padding: 0, fontSize: 22, lineHeight: 1 }}
    >×</button>
    <figure style={styles.imageLightboxPanel}>
      <img
        src={activeImage.url}
        alt={`${activeImage.name} enlarged`}
        data-handrail-enhancement-lightbox-image="true"
        style={styles.imageLightboxImage}
      />
      <div style={{ display: "grid", gridTemplateColumns: images.length > 1 ? "auto minmax(0, 1fr) auto" : "minmax(0, 1fr)", alignItems: "center", gap: 10 }}>
        {images.length > 1 && <button type="button" aria-label="Previous image" disabled={!hasPrevious} onClick={() => move(-1)} style={{ ...buttonStyle("secondary"), opacity: hasPrevious ? 1 : 0.5 }}>← Previous</button>}
        <figcaption aria-live="polite" style={{ minWidth: 0, textAlign: "center" }}>
          <strong title={activeImage.name} style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{activeImage.name}</strong>
          <span style={{ color: "var(--handrail-enhancement-muted-text)", fontSize: 11 }}>{activeIndex + 1} of {images.length}</span>
        </figcaption>
        {images.length > 1 && <button type="button" aria-label="Next image" disabled={!hasNext} onClick={() => move(1)} style={{ ...buttonStyle("secondary"), opacity: hasNext ? 1 : 0.5 }}>Next →</button>}
      </div>
    </figure>
  </section>;
}

function displayLabel(value: string): string {
  const normalized = value.replaceAll("_", " ").trim();
  return normalized
    ? `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`
    : value;
}

function requestDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? "—"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function displayAppVersion(value: string | null | undefined): string {
  const version = value?.trim();
  if (!version) return "—";
  return version.startsWith("v") ? version : `v${version}`;
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

function incrementHistorySummary(
  summary: EnhancementHistorySummary | null,
  statusGroup: EnhancementHistoryStatusGroup,
): EnhancementHistorySummary | null {
  if (!summary) return null;
  return {
    ...summary,
    total: summary.total + 1,
    [statusGroup]: summary[statusGroup] + 1,
  };
}

function requestMatchesHistoryQuery(
  request: EnhancementRequestRecord,
  query: EnhancementHistoryListOptions,
): boolean {
  const visibility = query.visibility || "active";
  if (visibility === "active" && request.dismissed) return false;
  if (visibility === "dismissed" && !request.dismissed) return false;
  if (query.statusGroup && request.status_group !== query.statusGroup) return false;
  const search = query.search?.trim().toLocaleLowerCase();
  if (!search) return true;
  const release = enhancementReleaseSummary(request);
  return [
    request.id,
    request.title,
    request.description,
    request.status,
    request.linked_work_request?.id,
    release.label,
    release.version,
  ].some((value) => value?.toLocaleLowerCase().includes(search));
}

function journeyDuration(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value < 0) return "";
  const seconds = Math.round(value / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${String(seconds % 60).padStart(2, "0")}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function milestoneColor(state: EnhancementDeliveryMilestone["state"]): string {
  if (state === "completed") return "var(--handrail-enhancement-success-text)";
  if (state === "active") return "var(--handrail-enhancement-accent)";
  if (state === "waiting") return "var(--handrail-enhancement-warning-text)";
  if (state === "blocked") return "var(--handrail-enhancement-danger-text)";
  return "var(--handrail-enhancement-border)";
}

function journeyStatusStyle(state: NonNullable<EnhancementRequestRecord["delivery_journey"]>["state"]): CSSProperties {
  if (state === "succeeded") return enhancementStatusStyle("succeeded");
  if (state === "active") return enhancementStatusStyle("in_progress");
  if (state === "waiting") {
    return {
      color: "var(--handrail-enhancement-warning-text)",
      borderColor: "color-mix(in srgb, var(--handrail-enhancement-warning-text) 30%, transparent)",
      background: "var(--handrail-enhancement-warning-surface)",
    };
  }
  if (state === "blocked") return enhancementStatusStyle("needs_attention");
  return enhancementStatusStyle("closed");
}

function JourneyTimeline({ request, expanded = false }: {
  readonly request: EnhancementRequestRecord;
  readonly expanded?: boolean;
}): ReactElement {
  const milestones = request.delivery_journey?.milestones || [];
  if (!milestones.length) {
    return <span style={{ color: "var(--handrail-enhancement-muted-text)", fontSize: 11 }}>Delivery journey unavailable</span>;
  }
  return <div
    role="list"
    aria-label={`Delivery progress for ${request.title}`}
    data-handrail-enhancement-delivery-journey="true"
    style={{ display: "grid", gridTemplateColumns: `repeat(${milestones.length}, minmax(0, 1fr))`, minWidth: 0 }}
  >
    {milestones.map((item, index) => {
      const duration = journeyDuration(item.duration_ms);
      const meta = item.state === "active"
        ? item.detail || "In progress"
        : item.state === "waiting"
          ? item.detail || "Waiting"
          : item.state === "blocked"
            ? item.detail || "Needs attention"
            : item.state === "skipped"
              ? "Not needed"
              : duration || (item.state === "completed" ? "Done" : "Waiting");
      const previous = milestones[index - 1];
      const connectorComplete = previous?.state === "completed"
        && !["pending", "skipped", "blocked"].includes(item.state);
      return <div key={item.key} role="listitem" style={{ position: "relative", minWidth: 0, padding: expanded ? "0 5px" : "0 3px", textAlign: "center" }}>
        {index > 0 && <span aria-hidden="true" style={{ position: "absolute", zIndex: 0, top: expanded ? 8 : 6, right: "50%", width: "100%", height: 2, background: connectorComplete ? "var(--handrail-enhancement-success-text)" : "var(--handrail-enhancement-border)" }} />}
        <span aria-hidden="true" style={{ position: "relative", zIndex: 1, display: "inline-flex", width: expanded ? 17 : 13, height: expanded ? 17 : 13, alignItems: "center", justifyContent: "center", border: `2px solid ${milestoneColor(item.state)}`, borderRadius: 999, color: item.state === "completed" ? "var(--handrail-enhancement-accent-text)" : milestoneColor(item.state), background: item.state === "completed" ? "var(--handrail-enhancement-success-text)" : "var(--handrail-enhancement-surface)", boxShadow: item.state === "active" ? "0 0 0 4px color-mix(in srgb, var(--handrail-enhancement-accent) 16%, transparent)" : "none", fontSize: 9, fontWeight: 900 }}>{item.state === "completed" ? "✓" : item.state === "blocked" ? "!" : ""}</span>
        <strong style={{ display: "block", overflow: "hidden", marginTop: 4, color: item.state === "active" || item.state === "waiting" || item.state === "blocked" ? milestoneColor(item.state) : "var(--handrail-enhancement-text)", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: expanded ? 11 : 9.5 }}>{item.label}</strong>
        <span title={meta} style={{ display: "block", overflow: "hidden", marginTop: 1, color: item.state === "active" || item.state === "waiting" || item.state === "blocked" ? milestoneColor(item.state) : "var(--handrail-enhancement-muted-text)", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: expanded ? 10 : 8.5 }}>{meta}</span>
      </div>;
    })}
  </div>;
}

function HistoryRow({
  request,
  busy,
  expanded,
  onToggle,
  attachmentUrl,
  onPreviewAttachments,
  canRestore,
  onArchive,
  onRestore,
}: {
  readonly request: EnhancementRequestRecord;
  readonly busy: boolean;
  readonly expanded: boolean;
  readonly onToggle: (requestId: string) => void;
  readonly attachmentUrl: (requestId: string, attachmentId: string) => string;
  readonly onPreviewAttachments: (
    images: readonly PreviewableImage[],
    activeIndex: number,
    trigger: HTMLButtonElement,
  ) => void;
  readonly canRestore: boolean;
  readonly onArchive: (requestId: string) => Promise<void>;
  readonly onRestore: (requestId: string) => Promise<void>;
}): ReactElement {
  const release = enhancementReleaseSummary(request);
  const journey = request.delivery_journey;
  const attachmentImages: readonly PreviewableImage[] = (request.attachments || [])
    .filter((attachment) => (
      Boolean(attachment?.id)
      && Boolean(attachment?.filename)
      && /^image\/(?:png|jpeg|gif|webp)$/iu.test(attachment?.mime_type || "")
    ))
    .map((attachment) => ({
      id: attachment.id,
      name: attachment.filename,
      url: attachmentUrl(request.id, attachment.id),
    }));
  return <article role="row" data-handrail-enhancement-history-row="true" style={styles.historyItem}>
    <div role="cell" style={{ minWidth: 0 }}>
      <strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13 }}>{request.title}</strong>
      <span style={{ display: "block", overflow: "hidden", marginTop: 3, color: "var(--handrail-enhancement-muted-text)", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 10 }}>{displayAppVersion(request.reported_app_version)}{request.priority ? ` · ${displayLabel(request.priority)} priority` : ""}</span>
    </div>
    <div role="cell" data-handrail-enhancement-history-cell="journey" style={{ minWidth: 0 }}><JourneyTimeline request={request} /></div>
    <div role="cell" data-handrail-enhancement-history-cell="status">
      <span style={{ display: "inline-block", overflow: "hidden", maxWidth: "100%", padding: "3px 8px", border: "1px solid", borderRadius: 999, textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 10, fontWeight: 800, ...(journey ? journeyStatusStyle(journey.state) : enhancementStatusStyle(request.status_group)) }}>{journey?.label || displayLabel(request.status)}</span>
      {journey?.implementation_mode && <span style={{ display: "block", marginTop: 4, color: "var(--handrail-enhancement-muted-text)", fontSize: 9 }}>{journey.implementation_mode === "automatic" ? "Advanced automatically" : "Team authorized"}</span>}
    </div>
    <span role="cell" data-handrail-enhancement-history-cell="secondary" style={{ color: "var(--handrail-enhancement-muted-text)", fontSize: 11 }}>{requestDate(request.created_at)}</span>
    <div role="cell" data-handrail-enhancement-history-cell="action" style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
      <button type="button" aria-expanded={expanded} aria-label={`View ${request.title}`} onClick={() => onToggle(request.id)} style={{ border: 0, padding: "6px 2px", color: "var(--handrail-enhancement-accent)", background: "transparent", cursor: "pointer", font: "inherit", fontSize: 12, fontWeight: 800 }}>View</button>
      {request.dismissed && canRestore
        ? <button type="button" aria-label={`Restore ${request.title}`} disabled={busy} onClick={() => void onRestore(request.id)} style={{ border: 0, padding: "6px 2px", color: "var(--handrail-enhancement-accent)", background: "transparent", cursor: busy ? "wait" : "pointer", font: "inherit", fontSize: 12, fontWeight: 800 }}>{busy ? "Restoring…" : "Restore"}</button>
        : !request.dismissed && <button type="button" aria-label={`Archive ${request.title}`} disabled={busy} onClick={() => void onArchive(request.id)} style={{ border: 0, padding: "6px 2px", color: "var(--handrail-enhancement-accent)", background: "transparent", cursor: busy ? "wait" : "pointer", font: "inherit", fontSize: 12, fontWeight: 800 }}>{busy ? "Archiving…" : "Archive"}</button>}
    </div>
    {expanded && <div role="cell" data-handrail-enhancement-history-detail="true" style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "minmax(0, 1.7fr) minmax(250px, .8fr)", gap: 12, padding: 12, border: "1px solid var(--handrail-enhancement-border)", borderRadius: 10, color: "var(--handrail-enhancement-muted-text)", background: "var(--handrail-enhancement-surface-muted)", fontSize: 11 }}>
      <section style={{ display: "grid", minWidth: 0, gap: 12 }}>
        <div>
          <strong style={{ display: "block", marginBottom: 3, color: "var(--handrail-enhancement-text)", fontSize: 13 }}>{journey?.label || "Request details"}</strong>
          <span>{journey?.summary || request.description || "No additional description is available."}</span>
        </div>
        {journey && <div style={{ padding: "12px 8px", border: "1px solid var(--handrail-enhancement-border)", borderRadius: 9, background: "var(--handrail-enhancement-surface)" }}><JourneyTimeline request={request} expanded /></div>}
        {attachmentImages.length > 0 && <section aria-label="Submitted attachments">
          <strong style={{ display: "block", marginBottom: 6, color: "var(--handrail-enhancement-text)" }}>Submitted attachments</strong>
          <div data-handrail-enhancement-history-attachments="true" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 8 }}>
            {attachmentImages.map((attachment, index) => <button
              key={attachment.id}
              type="button"
              aria-label={`View submitted attachment ${attachment.name}`}
              aria-haspopup="dialog"
              onClick={(event) => onPreviewAttachments(attachmentImages, index, event.currentTarget)}
              style={{ ...styles.imagePreviewButton, border: "1px solid var(--handrail-enhancement-border)", borderRadius: 9, color: "var(--handrail-enhancement-text)", background: "var(--handrail-enhancement-surface)" }}
            >
              <span style={{ position: "relative", display: "block" }}>
                <img src={attachment.url} alt="" loading="lazy" data-handrail-enhancement-history-attachment-preview="true" style={{ display: "block", width: "100%", height: 96, objectFit: "cover", background: "var(--handrail-enhancement-surface-muted)" }} />
                <span
                  data-handrail-enhancement-image-expand-affordance="true"
                  aria-hidden="true"
                  style={{ position: "absolute", right: 6, bottom: 6, display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 6px", borderRadius: 999, color: "var(--handrail-enhancement-accent-text)", background: "var(--handrail-enhancement-accent)", boxShadow: "0 1px 4px rgba(0, 0, 0, 0.28)", fontSize: 9, fontWeight: 800, lineHeight: 1 }}
                ><span style={{ fontSize: 12 }}>↗</span> View</span>
              </span>
              <span title={attachment.name} style={{ display: "block", overflow: "hidden", padding: "7px 8px", textAlign: "left", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 10 }}>{attachment.name}</span>
            </button>)}
          </div>
        </section>}
        <div>
          <strong style={{ display: "block", marginBottom: 6, color: "var(--handrail-enhancement-text)" }}>How your idea moved forward</strong>
          <div style={{ display: "grid", gap: 5 }}>
            {(journey?.milestones || []).filter((item) => item.state === "completed").map((item) => <span key={item.key} style={{ color: "var(--handrail-enhancement-text)" }}><span aria-hidden="true" style={{ marginRight: 7, color: "var(--handrail-enhancement-success-text)", fontWeight: 900 }}>✓</span>{item.label}{item.detail ? ` — ${item.detail}` : ""}</span>)}
            {!journey && <span>{request.description || "No additional description is available."}</span>}
          </div>
        </div>
        {request.description && journey && <div><strong style={{ display: "block", color: "var(--handrail-enhancement-text)" }}>Original request</strong>{request.description}</div>}
      </section>
      <aside style={{ alignSelf: "start", overflow: "hidden", border: "1px solid var(--handrail-enhancement-border)", borderRadius: 9, background: "var(--handrail-enhancement-surface)" }}>
        <strong style={{ display: "block", padding: "9px 11px", borderBottom: "1px solid var(--handrail-enhancement-border)", color: "var(--handrail-enhancement-text)" }}>Delivery receipt</strong>
        {journey?.total_elapsed_ms != null && <span style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 11px", borderBottom: "1px solid var(--handrail-enhancement-border)" }}><span>Total time</span><strong style={{ color: "var(--handrail-enhancement-text)" }}>{journeyDuration(journey.total_elapsed_ms)}</strong></span>}
        {journey?.assessed_change_risk && <span style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 11px", borderBottom: "1px solid var(--handrail-enhancement-border)" }}><span>Assessed change</span><strong style={{ color: "var(--handrail-enhancement-text)" }}>{displayLabel(journey.assessed_change_risk)} risk</strong></span>}
        {journey?.implementation_mode && <span style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 11px", borderBottom: "1px solid var(--handrail-enhancement-border)" }}><span>Implementation</span><strong style={{ color: "var(--handrail-enhancement-text)" }}>{journey.implementation_mode === "automatic" ? "Automatic" : "Team authorized"}</strong></span>}
        {journey?.manual_handoffs != null && <span style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 11px", borderBottom: "1px solid var(--handrail-enhancement-border)" }}><span>Manual handoffs</span><strong style={{ color: "var(--handrail-enhancement-text)" }}>{journey.manual_handoffs}</strong></span>}
        {(journey?.released_environment || journey?.shipped_environment) && <span style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 11px", borderBottom: "1px solid var(--handrail-enhancement-border)" }}><span>Released to</span><strong style={{ color: "var(--handrail-enhancement-success-text)" }}>{displayLabel(journey.released_environment || journey.shipped_environment || "")}</strong></span>}
        {journey?.verification_status && <span style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 11px", borderBottom: "1px solid var(--handrail-enhancement-border)" }}><span>Confirmation</span><strong style={{ color: "var(--handrail-enhancement-text)" }}>{displayLabel(journey.verification_status)}</strong></span>}
        {journey?.verified_environment && <span style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 11px", borderBottom: "1px solid var(--handrail-enhancement-border)" }}><span>Confirmed in</span><strong style={{ color: "var(--handrail-enhancement-success-text)" }}>{displayLabel(journey.verified_environment)}</strong></span>}
        <span style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 11px", borderBottom: "1px solid var(--handrail-enhancement-border)" }}><span>Release</span><strong style={{ color: "var(--handrail-enhancement-text)", ...releaseStyle(release.state) }}>{release.label}</strong></span>
        <span style={{ display: "block", padding: "8px 11px" }}><strong style={{ display: "block", color: "var(--handrail-enhancement-text)" }}>Submitted</strong>{requestDate(request.created_at)} · {displayAppVersion(request.reported_app_version)}</span>
        <span style={{ display: "block", padding: "0 11px 8px" }}><strong style={{ display: "block", color: "var(--handrail-enhancement-text)" }}>Reference ID</strong>{request.id}</span>
        {Boolean(request.attachments?.length) && <span style={{ display: "block", padding: "0 11px 8px" }}><strong style={{ color: "var(--handrail-enhancement-text)" }}>Attachments:</strong> {request.attachments!.map((attachment) => attachment.filename).join(", ")}</span>}
      </aside>
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
  const [priority, setPriority] = useState<EnhancementPriority>("medium");
  const [accessRole, setAccessRole] = useState<EnhancementAutomationRole | null>(null);
  const [accessPolicy, setAccessPolicy] = useState<EnhancementReporterPolicy | null>(null);
  const [notifyOnResolution, setNotifyOnResolution] = useState(false);
  const [notificationAvailable, setNotificationAvailable] = useState(false);
  const [notificationRecipientHint, setNotificationRecipientHint] = useState<string | null>(null);
  const [images, setImages] = useState<SelectedImage[]>([]);
  const [expandedImageId, setExpandedImageId] = useState<string | null>(null);
  const [imageOrderAnnouncement, setImageOrderAnnouncement] = useState("");
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
  const [historyImagePreview, setHistoryImagePreview] = useState<{
    readonly images: readonly PreviewableImage[];
    readonly activeIndex: number;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<EnhancementSubmissionResult | null>(null);
  const previewUrls = useRef(new Set<string>());
  const historySearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historyLoadedRef = useRef(false);
  const historyStaleRef = useRef(true);
  const historyLoadingRef = useRef(false);
  const historyDiscoveryReadyRef = useRef(false);
  const historyGenerationRef = useRef(0);
  const dialogRef = useRef<HTMLElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const imagePreviewTriggerRef = useRef<HTMLButtonElement | null>(null);
  const historyImagePreviewTriggerRef = useRef<HTMLButtonElement | null>(null);
  const headingId = useId();
  const descriptionId = useId();
  const newPanelId = useId();
  const pageSize = Math.max(1, Math.min(50, Math.floor(historyPageSize) || 10));
  const resolvedAppVersion = appVersion || client.appVersion;
  const attachedContext = {
    route: typeof location !== "undefined" ? `${location.pathname}${location.search}` : undefined,
    pageTitle: typeof document !== "undefined" ? document.title || undefined : undefined,
    appVersion: resolvedAppVersion,
    viewport: typeof window !== "undefined" ? `${window.innerWidth}x${window.innerHeight}` : undefined,
  };
  const automaticImplementationRisk = accessPolicy?.cells?.automatic_fix_max_risk;
  const productionRisk = accessPolicy?.cells?.production_max_risk_by_priority?.[priority];
  const riskThresholdLabel = (risk: string | undefined): string => risk === "none"
    ? "not automatic"
    : risk ? `up to ${risk} change risk` : "not available";

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
    const generation = ++historyGenerationRef.current;
    historyStaleRef.current = true;
    historyLoadingRef.current = true;
    setLoadingHistory(true);
    setError(null);
    try {
      const page = await client.list({ limit: pageSize, offset, ...query });
      if (generation !== historyGenerationRef.current) return;
      setHistory((current) => offset === 0
        ? page.requests
        : [...current, ...page.requests.filter(
            (request) => !current.some((existing) => existing.id === request.id),
          )]);
      setHistoryHasMore(page.pagination.has_more);
      setHistoryTotal(page.pagination.total);
      setHistorySummary(page.summary);
      historyLoadedRef.current = true;
      historyStaleRef.current = false;
    } catch (caught) {
      if (generation !== historyGenerationRef.current) return;
      setError(caught instanceof Error
        ? caught.message
        : "Could not load enhancement requests.");
    } finally {
      if (generation === historyGenerationRef.current) {
        historyLoadingRef.current = false;
        setLoadingHistory(false);
      }
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
    historyGenerationRef.current += 1;
    historyLoadedRef.current = false;
    historyStaleRef.current = true;
    historyLoadingRef.current = false;
    historyDiscoveryReadyRef.current = false;
    setHistoryCapabilities(null);
    setHistory([]);
    setHistoryHasMore(false);
    setHistoryTotal(0);
    setHistorySummary(null);
    setNotifyOnResolution(false);
    setNotificationAvailable(false);
    setNotificationRecipientHint(null);
    setAccessRole(null);
    setAccessPolicy(null);
    setExpandedImageId(null);
    setHistoryImagePreview(null);
    setImageOrderAnnouncement("");
    setDiscovering(true);
    void client.discover().then((discovery) => {
      if (cancelled) return;
      const reporting = discovery?.enhancement_reporting;
      const capabilities = reporting?.history || null;
      const accessTier = reporting?.access_level || reporting?.policy?.tier;
      setAccessRole(reporting?.role
        || (accessTier === "full_access"
          ? "maintainer"
          : accessTier === "user"
            ? "contributor"
            : accessTier === "default" ? "requester" : null));
      setAccessPolicy(reporting?.policy || null);
      // Current discovery owns history through history.enabled. Fall back to
      // user_enabled only for servers that predate the history capability.
      const ownedHistoryEnabled = capabilities?.enabled === true
        || (capabilities?.enabled === undefined
          && discovery?.enhancement_reporting?.user_enabled === true);
      historyDiscoveryReadyRef.current = true;
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
        historyDiscoveryReadyRef.current = false;
        setHistoryAvailable(false);
        setHistoryCapabilities(null);
        setNotificationAvailable(false);
        setNotificationRecipientHint(null);
        setAccessRole(null);
        setAccessPolicy(null);
      }
    }).finally(() => {
      if (!cancelled) setDiscovering(false);
    });
    return () => {
      cancelled = true;
      historyGenerationRef.current += 1;
      historyLoadingRef.current = false;
      historyDiscoveryReadyRef.current = false;
    };
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
    if (
      open
      && tab === "history"
      && (!historyLoadedRef.current || historyStaleRef.current)
      && !historyLoadingRef.current
    ) {
      void loadHistory(0);
    }
  }, [loadHistory, open, tab]);

  useEffect(() => {
    if (
      open
      && historyAvailable
      && !discovering
      && historyDiscoveryReadyRef.current
      && !historyLoadedRef.current
      && historyStaleRef.current
      && !historyLoadingRef.current
    ) {
      void loadHistory(0);
    }
  }, [discovering, historyAvailable, loadHistory, open]);

  useEffect(() => {
    if (!open || tab !== "history") return undefined;
    const interval = setInterval(() => {
      if (!historyLoadingRef.current) void loadHistory(0);
    }, HISTORY_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
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

  const removeImage = (id: string) => {
    if (expandedImageId === id) setExpandedImageId(null);
    const removed = images.find((image) => image.id === id);
    setImages((current) => current.filter((image) => {
      if (image.id !== id) return true;
      revokePreview(image, previewUrls.current);
      return false;
    }));
    if (removed) setImageOrderAnnouncement(`Removed ${removed.name}.`);
  };

  const moveImage = (id: string, direction: -1 | 1) => {
    const currentIndex = images.findIndex((image) => image.id === id);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= images.length) return;
    const reordered = [...images];
    const moved = reordered[currentIndex];
    if (!moved) return;
    reordered.splice(currentIndex, 1);
    reordered.splice(nextIndex, 0, moved);
    setImages(reordered);
    setImageOrderAnnouncement(`${moved.name} moved to position ${nextIndex + 1} of ${reordered.length}.`);
  };

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
      setSubmitted(result);
      historyStaleRef.current = true;
      if (historyLoadedRef.current) {
        const query = currentHistoryQuery();
        const alreadyVisible = history.some((request) => request.id === result.request.id);
        const matchesQuery = requestMatchesHistoryQuery(result.request, query);
        if (matchesQuery && query.sort !== "oldest") {
          setHistory((current) => [
            result.request,
            ...current.filter((request) => request.id !== result.request.id),
          ].slice(0, pageSize));
        }
        if (matchesQuery && !alreadyVisible && !result.replayed) {
          setHistoryTotal((current) => current + 1);
          setHistorySummary((current) => (
            incrementHistorySummary(current, result.request.status_group)
          ));
        }
      }
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
  const expandedImage = images.find((image) => image.id === expandedImageId) || null;
  const selectionPreviewImages: readonly PreviewableImage[] = images
    .filter((image): image is SelectedImage & { readonly preview: string } => Boolean(image.preview))
    .map((image) => ({ id: image.id, name: image.name, url: image.preview }));
  const selectionPreviewIndex = expandedImage
    ? selectionPreviewImages.findIndex((image) => image.id === expandedImage.id)
    : -1;
  const closeImagePreview = () => {
    setExpandedImageId(null);
    imagePreviewTriggerRef.current?.focus();
  };
  const openHistoryImagePreview = (
    previewImages: readonly PreviewableImage[],
    activeIndex: number,
    trigger: HTMLButtonElement,
  ) => {
    historyImagePreviewTriggerRef.current = trigger;
    setHistoryImagePreview({ images: previewImages, activeIndex });
  };
  const closeHistoryImagePreview = () => {
    setHistoryImagePreview(null);
    historyImagePreviewTriggerRef.current?.focus();
  };
  const startAnotherRequest = () => {
    setSubmitted(null);
    setError(null);
    setTitle("");
    setDescription("");
    setPriority("medium");
    for (const image of images) revokePreview(image, previewUrls.current);
    setImages([]);
    setExpandedImageId(null);
    setImageOrderAnnouncement("");
    setDragActive(false);
    setNotifyOnResolution(false);
  };
  const closeDialog = () => {
    if (submitting) return;
    if (submitted) startAnotherRequest();
    onClose();
  };

  const selectView = (next: DialogTab) => {
    setHistoryImagePreview(null);
    setTab(next);
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

  const shippedCount = historySummary?.shipped ?? historySummary?.succeeded ?? history.filter((request) => request.status === "completed").length;
  const movingCount = historySummary && (historySummary.building != null || historySummary.assessing != null)
    ? (historySummary.building || 0) + (historySummary.assessing || 0)
    : historySummary?.in_progress ?? historyCountFor("in_progress");
  const planReadyCount = historySummary?.awaiting_team ?? history.filter((request) => request.status === "proposal_ready" || request.status === "backlog").length;
  const needsYouCount = historySummary?.awaiting_user ?? history.filter((request) => request.status === "needs_clarification").length;
  const dialogHeading = tab === "history" ? "My requests" : heading;
  const dialogDescription = tab === "history"
    ? "Follow each request from suggestion through delivery."
    : "Describe the improvement and review the attached context before sending.";

  const historyForm = <form onSubmit={(event) => {
    event.preventDefault();
    void loadHistory(0);
  }}>
    <div data-handrail-enhancement-history-overview="true" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(130px, 1fr))", overflow: "hidden", marginBottom: 10, border: "1px solid var(--handrail-enhancement-border)", borderRadius: 10, background: "var(--handrail-enhancement-surface)" }}>
      {([
        ["✓", shippedCount, "Ideas released", "var(--handrail-enhancement-success-text)"],
        ["↗", movingCount, "Moving now", "var(--handrail-enhancement-accent)"],
        ["◇", planReadyCount, "Plans ready", "var(--handrail-enhancement-warning-text)"],
        ["!", needsYouCount, "Waiting on you", needsYouCount ? "var(--handrail-enhancement-danger-text)" : "var(--handrail-enhancement-success-text)"],
      ] as const).map(([icon, count, label, color], index) => <div key={label} style={{ display: "grid", gridTemplateColumns: "28px 1fr", gap: 8, padding: "10px 12px", borderLeft: index ? "1px solid var(--handrail-enhancement-border)" : 0 }}>
        <span aria-hidden="true" style={{ display: "flex", width: 26, height: 26, alignItems: "center", justifyContent: "center", borderRadius: 999, color, background: `color-mix(in srgb, ${color} 10%, transparent)`, fontWeight: 900 }}>{icon}</span>
        <span><strong style={{ display: "block", color: "var(--handrail-enhancement-text)", fontSize: 16, lineHeight: 1 }}>{count}</strong><span style={{ color: "var(--handrail-enhancement-muted-text)", fontSize: 10 }}>{label}</span></span>
      </div>)}
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
      {historyCapabilities?.search && <input aria-label="Search my requests" autoComplete="off" maxLength={200} type="search" value={historySearch} onChange={(event) => searchHistory(event.target.value)} placeholder="Search title or app version…" style={{ ...styles.input, flex: "1 1 320px", minWidth: 0 }} />}
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
          {tab === "new" && <div style={{ marginBottom: 4, color: "var(--handrail-enhancement-accent)", fontSize: 10, fontWeight: 800, letterSpacing: "0.14em" }}>HELP US IMPROVE IT</div>}
          <h2 id={headingId} style={{ margin: 0, fontSize: 20, lineHeight: 1.2, letterSpacing: "-0.02em" }}>{dialogHeading}</h2>
          <div id={descriptionId} style={{ marginTop: 4, color: "var(--handrail-enhancement-muted-text)", fontSize: 12 }}>
            {dialogDescription}
          </div>
        </div>
        <div style={{ display: "flex", flex: "0 0 auto", alignItems: "center", gap: 8 }}>
          {historyAvailable && <button
            type="button"
            data-handrail-enhancement-view-switch={tab === "history" ? "new" : "history"}
            aria-label={tab === "history" ? "Request an enhancement" : "View my enhancement requests"}
            onClick={() => selectView(tab === "history" ? "new" : "history")}
            style={tab === "history" ? buttonStyle("primary") : buttonStyle("secondary")}
          >
            {tab === "history" ? "New request" : "My requests"}
            {tab === "new" && historyLoadedRef.current && <span aria-label={`${historyTotal} total`} style={{ display: "inline-grid", placeItems: "center", minWidth: 20, height: 20, marginLeft: 7, padding: "0 5px", borderRadius: 999, color: "var(--handrail-enhancement-muted-text)", background: "var(--handrail-enhancement-surface-muted)", fontSize: 10 }}>{historyTotal}</span>}
          </button>}
          <button type="button" aria-label="Close enhancement reporter" disabled={submitting} onClick={closeDialog} style={{ ...buttonStyle("secondary"), width: 38, minWidth: 38, height: 38, padding: 0, fontSize: 20, lineHeight: 1, opacity: submitting ? 0.65 : 1 }}>×</button>
        </div>
      </header>
      <div data-handrail-enhancement-content={tab} style={{ ...styles.content, ...(tab === "history" ? styles.historyContent : {}) }}>
        {error && <div role="alert" aria-live="assertive" style={{ ...styles.status, background: "var(--handrail-enhancement-danger-surface)", color: "var(--handrail-enhancement-danger-text)" }}>{error}</div>}
        {tab === "new" ? <div id={newPanelId} data-handrail-enhancement-report-panel="true" style={{ display: "flex", minHeight: 0, flex: "1 1 auto", flexDirection: "column" }}>
          {submitted ? <section
            data-handrail-enhancement-submission-success="true"
            aria-labelledby={`${newPanelId}-success-heading`}
            style={{
              display: "grid",
              alignContent: "center",
              justifyItems: "center",
              minHeight: "min(520px, 60vh)",
              padding: "32px 18px",
              textAlign: "center",
            }}
          >
            <div
              aria-hidden="true"
              style={{
                display: "grid",
                placeItems: "center",
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "var(--handrail-enhancement-success-surface)",
                color: "var(--handrail-enhancement-success-text)",
                fontSize: 30,
                fontWeight: 800,
              }}
            >✓</div>
            <h3 id={`${newPanelId}-success-heading`} style={{ margin: "18px 0 8px", fontSize: 24 }}>
              Thanks for submitting this enhancement
            </h3>
            <p role="status" aria-live="polite" style={{ maxWidth: 560, margin: 0, color: "var(--handrail-enhancement-muted-text)", lineHeight: 1.55 }}>
              Your request was sent to the product team. You can follow its progress from My requests.
            </p>
            {submitted.notification_subscription?.active === true && <div style={{ ...styles.status, maxWidth: 560, marginTop: 18, marginBottom: 0, background: "var(--handrail-enhancement-success-surface)", color: "var(--handrail-enhancement-success-text)" }}>
              Email updates are enabled{submitted.notification_subscription.recipient_hint ? ` for ${submitted.notification_subscription.recipient_hint}` : ""}.
            </div>}
            {submitted.notification_warning && <div role="alert" style={{ ...styles.status, maxWidth: 560, marginTop: 18, marginBottom: 0, background: "var(--handrail-enhancement-danger-surface)", color: "var(--handrail-enhancement-danger-text)" }}>
              Your enhancement is saved, but email updates could not be enabled.
            </div>}
            <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap", marginTop: 24 }}>
              <button type="button" onClick={startAnotherRequest} style={buttonStyle("secondary")}>Submit another enhancement</button>
              <button type="button" onClick={closeDialog} style={buttonStyle("primary")}>Done</button>
            </div>
          </section> : <>
            {discovering && <div role="status" style={{ marginBottom: 12, color: "var(--handrail-enhancement-muted-text)", fontSize: 12 }}>Checking available options…</div>}
            <form data-handrail-enhancement-report-form="true" onSubmit={(event) => void submit(event)} style={{ display: "flex", width: "100%", minHeight: 0, flex: "1 1 auto", flexDirection: "column" }}>
            <span role="status" aria-live="polite" style={styles.visuallyHidden}>
              {submitting ? "Submitting your enhancement request…" : imageOrderAnnouncement}
            </span>
            <div data-handrail-enhancement-report-layout="true" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.8fr) minmax(280px, .72fr)", gap: 16, minHeight: 0, flex: "1 1 auto", alignItems: "stretch" }}>
              <section data-handrail-enhancement-report-details="true" aria-label="Enhancement details" style={{ display: "grid", gridTemplateRows: "auto minmax(150px, 1.3fr) minmax(132px, 1fr)", minHeight: 0 }}>
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
                <label data-handrail-enhancement-expanding-field="true" style={{ ...styles.label, gridTemplateRows: "auto minmax(0, 1fr)", minHeight: 0 }}>
                  Desired outcome
                  <textarea style={{ ...styles.input, height: "100%", minHeight: 96, resize: "vertical" }} maxLength={20_000} required value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe the outcome you want. You can paste screenshots here." />
                </label>
                <div
              data-handrail-enhancement-image-dropzone="true"
              onDragEnter={onImageDragOver}
              onDragOver={onImageDragOver}
              onDragLeave={() => setDragActive(false)}
              onDrop={onImageDrop}
              style={{
                ...styles.drop,
                justifyContent: images.length > 0 ? "flex-start" : "center",
                ...(dragActive ? { borderColor: "var(--handrail-enhancement-accent)", color: "var(--handrail-enhancement-accent)" } : {}),
              }}
            >
                  <strong>Add screenshots or images</strong>
                  <div style={{ marginTop: 3, fontSize: 11 }}>Upload, paste, or drop PNG, JPEG, GIF, or WebP images. Up to 4 images, 5 MiB each and 15 MiB total.</div>
                  <label style={{ display: "inline-block", marginTop: 8, cursor: "pointer", color: "var(--handrail-enhancement-accent)", fontWeight: 700 }}>
                    Choose images
                    <input aria-label="Choose enhancement images" type="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple onChange={onFiles} style={{ display: "none" }} />
                  </label>
                  {images.length > 0 && <div style={styles.imageGrid}>{images.map((image, index) => <div key={image.id} style={styles.imageCard}>
                    {image.preview && <button
                      type="button"
                      aria-label={`View ${image.name} larger`}
                      aria-haspopup="dialog"
                      aria-expanded={expandedImageId === image.id}
                      onClick={(event) => {
                        imagePreviewTriggerRef.current = event.currentTarget;
                        setExpandedImageId(image.id);
                      }}
                      style={styles.imagePreviewButton}
                    >
                      <img src={image.preview} alt="" data-handrail-enhancement-image-preview="true" style={{ width: "100%", height: 110, objectFit: "cover", display: "block" }} />
                      <span
                        data-handrail-enhancement-image-expand-affordance="true"
                        aria-hidden="true"
                        style={{ position: "absolute", right: 6, bottom: 6, display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 6px", borderRadius: 999, color: "var(--handrail-enhancement-accent-text)", background: "var(--handrail-enhancement-accent)", boxShadow: "0 1px 4px rgba(0, 0, 0, 0.28)", fontSize: 9, fontWeight: 800, lineHeight: 1 }}
                      ><span style={{ fontSize: 12 }}>↗</span> View</span>
                    </button>}
                    <div title={image.name} style={{ padding: "7px 26px 7px 8px", whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden", fontSize: 11 }}>{image.name}</div>
                    <button type="button" aria-label={`Remove ${image.name}`} onClick={() => removeImage(image.id)} style={{ position: "absolute", top: 4, right: 4, width: 23, height: 23, padding: 0, border: 0, borderRadius: 12, cursor: "pointer", background: "rgba(15,23,42,.78)", color: "#fff" }}>×</button>
                    <div role="group" aria-label={`Reorder ${image.name}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4, padding: "0 6px 6px" }}>
                      <span style={{ color: "var(--handrail-enhancement-muted-text)", fontSize: 9 }}>{index + 1} of {images.length}</span>
                      <span style={{ display: "flex", gap: 4 }}>
                        <button type="button" aria-label={`Move ${image.name} earlier`} disabled={index === 0} onClick={() => moveImage(image.id, -1)} style={{ ...buttonStyle("secondary"), minHeight: 26, width: 28, padding: 0, opacity: index === 0 ? 0.45 : 1 }}>←</button>
                        <button type="button" aria-label={`Move ${image.name} later`} disabled={index === images.length - 1} onClick={() => moveImage(image.id, 1)} style={{ ...buttonStyle("secondary"), minHeight: 26, width: 28, padding: 0, opacity: index === images.length - 1 ? 0.45 : 1 }}>→</button>
                      </span>
                    </div>
                  </div>)}</div>}
                </div>
              </section>

              {expandedImage?.preview && selectionPreviewIndex >= 0 && <ImageLightbox
                images={selectionPreviewImages}
                activeIndex={selectionPreviewIndex}
                source="selection"
                onActiveIndexChange={(index) => setExpandedImageId(selectionPreviewImages[index]?.id || null)}
                onClose={closeImagePreview}
              />}

              <aside data-handrail-enhancement-context="true" aria-label="Attached context and options" style={{ display: "grid", alignSelf: "start", gap: 10 }}>
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

                {accessRole && <section data-handrail-enhancement-access-summary="true" style={{ overflow: "hidden", border: "1px solid var(--handrail-enhancement-border)", borderRadius: 9, background: "var(--handrail-enhancement-surface)" }}>
                  <h3 style={{ margin: 0, padding: "9px 12px", borderBottom: "1px solid var(--handrail-enhancement-border)", fontSize: 12 }}>Your access</h3>
                  <div style={{ padding: "8px 12px", fontSize: 11 }}>
                    <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}><span style={{ color: "var(--handrail-enhancement-muted-text)" }}>Role</span><strong>{displayLabel(accessRole)}</strong></span>
                    {automaticImplementationRisk && <span style={{ display: "block", marginTop: 5, color: "var(--handrail-enhancement-muted-text)" }}>Automatic implementation: {riskThresholdLabel(automaticImplementationRisk)}</span>}
                    {productionRisk && <span style={{ display: "block", marginTop: 2, color: "var(--handrail-enhancement-muted-text)" }}>Production eligibility for {displayLabel(priority)} priority: {riskThresholdLabel(productionRisk)}</span>}
                  </div>
                  <p style={{ margin: 0, padding: "8px 12px", color: "var(--handrail-enhancement-muted-text)", background: "var(--handrail-enhancement-surface-muted)", fontSize: 10 }}>Final deployment is evaluated separately under the project deployment policy.</p>
                </section>}

                {canNotify && <fieldset style={{ ...styles.fieldset, margin: 0 }}>
                  <legend style={{ padding: "0 5px", fontSize: 12, fontWeight: 700 }}>Updates</legend>
                  <label style={{ ...styles.checkboxLabel, marginTop: 0 }}>
                    <input aria-label="Email me when this enhancement is fixed" type="checkbox" checked={notifyOnResolution} onChange={(event) => setNotifyOnResolution(event.target.checked)} style={styles.checkboxInput} />
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
          </>}
        </div> : <div style={{ display: "flex", width: "100%", minHeight: 0, flex: "1 1 auto", flexDirection: "column" }}>
          {historyForm}
          {loadingHistory && history.length === 0 && <div role="status">Loading your enhancement requests…</div>}
          {!loadingHistory && history.length === 0 && !error && <div role="status" style={{ color: "var(--handrail-enhancement-muted-text)" }}>No enhancement requests match these filters.</div>}
          {history.length > 0 && <div role="table" aria-label="Enhancement requests" data-handrail-enhancement-history-list="true" style={{ ...styles.historyList, flex: "1 1 auto" }}>
            <div role="row" data-handrail-enhancement-history-header="true" style={styles.historyListHeader}>
              <span role="columnheader">Request</span><span role="columnheader">Delivery progress</span><span role="columnheader">Outcome</span><span role="columnheader">Submitted</span><span role="columnheader">Action</span>
            </div>
            {history.map((request) => <HistoryRow
              key={request.id}
              request={request}
              busy={busyHistoryId === request.id}
              expanded={expandedRequestId === request.id}
              onToggle={(requestId) => setExpandedRequestId((current) => current === requestId ? null : requestId)}
              attachmentUrl={client.attachmentUrl}
              onPreviewAttachments={openHistoryImagePreview}
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
      {historyImagePreview && <ImageLightbox
        images={historyImagePreview.images}
        activeIndex={historyImagePreview.activeIndex}
        source="history"
        onActiveIndexChange={(activeIndex) => setHistoryImagePreview((current) => current ? { ...current, activeIndex } : null)}
        onClose={closeHistoryImagePreview}
      />}
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
