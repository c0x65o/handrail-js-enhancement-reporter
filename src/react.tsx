import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type ClipboardEvent as ReactClipboardEvent,
  type FormEvent,
  type ReactNode,
} from "react";

import { reporterIdentity } from "./identity";
import {
  MAX_ENHANCEMENT_IMAGES,
  createEnhancementReporter,
  type EnhancementImageInput,
  type EnhancementReporterClient,
  type EnhancementReporterConfig,
  type EnhancementRequestRecord,
} from "./reporter";

const ReporterContext = createContext<EnhancementReporterClient | null>(null);

export interface EnhancementReporterProviderProps {
  readonly children: ReactNode;
  readonly client?: EnhancementReporterClient;
  readonly config?: EnhancementReporterConfig;
}

export function EnhancementReporterProvider({ children, client, config }: EnhancementReporterProviderProps) {
  const value = useMemo(() => client || createEnhancementReporter(config), [client, config]);
  return <ReporterContext.Provider value={value}>{children}</ReporterContext.Provider>;
}

export function useEnhancementReporter(): EnhancementReporterClient {
  const client = useContext(ReporterContext);
  if (!client) throw new Error("useEnhancementReporter must be used inside EnhancementReporterProvider");
  return client;
}

interface SelectedImage {
  readonly id: string;
  readonly input: EnhancementImageInput;
  readonly name: string;
  readonly preview: string | null;
}

export interface EnhancementReporterDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly client?: EnhancementReporterClient;
  readonly appVersion?: string;
  readonly heading?: string;
}

const styles: Record<string, CSSProperties> = {
  overlay: { position: "fixed", inset: 0, zIndex: 2147483000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "rgba(15,23,42,.52)" },
  dialog: { width: "min(620px, 100%)", maxHeight: "min(780px, calc(100vh - 40px))", overflow: "auto", borderRadius: 16, background: "#fff", color: "#18212f", boxShadow: "0 24px 70px rgba(15,23,42,.28)", fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 22px 14px", borderBottom: "1px solid #e7eaf0" },
  content: { padding: 22 },
  tabs: { display: "flex", gap: 6, padding: 4, marginBottom: 18, borderRadius: 10, background: "#f1f4f7" },
  tab: { flex: 1, border: 0, borderRadius: 8, padding: "8px 10px", cursor: "pointer", fontWeight: 650 },
  label: { display: "grid", gap: 7, marginBottom: 16, fontSize: 13, fontWeight: 650 },
  input: { width: "100%", boxSizing: "border-box", border: "1px solid #cfd6df", borderRadius: 9, padding: "10px 12px", color: "inherit", background: "#fff", font: "inherit" },
  drop: { border: "1px dashed #b7c1cd", borderRadius: 11, padding: 14, background: "#f8fafc", fontSize: 13, color: "#536173" },
  imageGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10, marginTop: 12 },
  imageCard: { position: "relative", minWidth: 0, border: "1px solid #dce2e9", borderRadius: 9, overflow: "hidden", background: "#fff" },
  button: { border: 0, borderRadius: 9, padding: "10px 15px", cursor: "pointer", fontWeight: 700 },
  error: { marginBottom: 14, borderRadius: 9, padding: "10px 12px", background: "#fff0f0", color: "#a51d1d", fontSize: 13 },
  success: { marginBottom: 14, borderRadius: 9, padding: "10px 12px", background: "#eaf8f0", color: "#17623b", fontSize: 13 },
  historyItem: { padding: "12px 0", borderBottom: "1px solid #edf0f4" },
};

function selectedFiles(files: readonly File[], source: "upload" | "clipboard", previews: Set<string>): SelectedImage[] {
  return files.filter((file) => file.type.startsWith("image/")).map((file) => {
    const preview = typeof URL !== "undefined" && typeof URL.createObjectURL === "function" ? URL.createObjectURL(file) : null;
    if (preview) previews.add(preview);
    return {
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
      name: file.name || `${source}-image`,
      preview,
      input: { data: file, filename: file.name, mimeType: file.type as EnhancementImageInput["mimeType"], source },
    };
  });
}

export function EnhancementReporterDialog({ open, onClose, client: explicitClient, appVersion, heading = "Suggest an enhancement" }: EnhancementReporterDialogProps) {
  const contextClient = useContext(ReporterContext);
  const client = explicitClient || contextClient;
  if (!client) throw new Error("EnhancementReporterDialog requires a client or EnhancementReporterProvider");
  const [tab, setTab] = useState<"new" | "history">("new");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<SelectedImage[]>([]);
  const [history, setHistory] = useState<readonly EnhancementRequestRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<EnhancementRequestRecord | null>(null);
  const previewUrls = useRef(new Set<string>());

  useEffect(() => () => {
    for (const url of previewUrls.current) URL.revokeObjectURL(url);
    previewUrls.current.clear();
  }, []);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    setError(null);
    try { setHistory((await client.list({ limit: 20 })).requests); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load enhancement requests."); }
    finally { setLoadingHistory(false); }
  }, [client]);

  useEffect(() => { if (open && tab === "history") void loadHistory(); }, [open, tab, loadHistory]);

  const addFiles = useCallback((files: readonly File[], source: "upload" | "clipboard") => {
    const added = selectedFiles(files, source, previewUrls.current);
    setImages((current) => {
      if (current.length + added.length > MAX_ENHANCEMENT_IMAGES) {
        for (const image of added) if (image.preview) { URL.revokeObjectURL(image.preview); previewUrls.current.delete(image.preview); }
        setError(`Attach at most ${MAX_ENHANCEMENT_IMAGES} images.`);
        return current;
      }
      setError(null);
      return [...current, ...added];
    });
  }, []);

  const onFiles = (event: ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(event.target.files || []), "upload");
    event.target.value = "";
  };
  const onPaste = (event: ReactClipboardEvent<HTMLElement>) => {
    const files = Array.from(event.clipboardData.items).filter((item) => item.kind === "file" && item.type.startsWith("image/")).map((item) => item.getAsFile()).filter((file): file is File => Boolean(file));
    if (files.length) { event.preventDefault(); addFiles(files, "clipboard"); }
  };
  const removeImage = (id: string) => setImages((current) => current.filter((image) => {
    if (image.id !== id) return true;
    if (image.preview) { URL.revokeObjectURL(image.preview); previewUrls.current.delete(image.preview); }
    return false;
  }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = await client.submit({ title, description, images: images.map((image) => image.input), context: { appVersion } });
      setSubmitted(result.request);
      setTitle("");
      setDescription("");
      for (const image of images) if (image.preview) { URL.revokeObjectURL(image.preview); previewUrls.current.delete(image.preview); }
      setImages([]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not submit the enhancement request.");
    } finally { setSubmitting(false); }
  };

  if (!open) return null;
  return <div style={styles.overlay} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-label={heading} style={styles.dialog} onPaste={onPaste}>
      <header style={styles.header}>
        <div><div style={{ fontSize: 18, fontWeight: 760 }}>{heading}</div><div style={{ marginTop: 3, color: "#697586", fontSize: 12 }}>Requests are sent to your product team as pending work.</div></div>
        <button type="button" aria-label="Close" onClick={onClose} style={{ ...styles.button, padding: "6px 10px", background: "transparent", fontSize: 20 }}>×</button>
      </header>
      <div style={styles.content}>
        <div style={styles.tabs}>
          <button type="button" style={{ ...styles.tab, background: tab === "new" ? "#fff" : "transparent", color: "#253044" }} onClick={() => setTab("new")}>New request</button>
          <button type="button" style={{ ...styles.tab, background: tab === "history" ? "#fff" : "transparent", color: "#253044" }} onClick={() => setTab("history")}>My requests</button>
        </div>
        {error && <div role="alert" style={styles.error}>{error}</div>}
        {submitted && tab === "new" && <div role="status" style={styles.success}>Submitted as pending Work Request <strong>{submitted.linked_work_request?.id || submitted.id}</strong>.</div>}
        {tab === "new" ? <form onSubmit={submit}>
          <label style={styles.label}>Short title<input style={styles.input} maxLength={500} required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What should be improved?" /></label>
          <label style={styles.label}>Details<textarea style={{ ...styles.input, minHeight: 130, resize: "vertical" }} maxLength={20_000} required value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe the outcome you want. You can paste screenshots here." /></label>
          <div style={styles.drop}>
            <strong>Add screenshots or images</strong><div style={{ marginTop: 4 }}>Upload files or paste from your clipboard. PNG, JPEG, GIF, or WebP; up to 4 images.</div>
            <label style={{ display: "inline-block", marginTop: 10, cursor: "pointer", color: "#245e9e", fontWeight: 700 }}>Choose images<input type="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple onChange={onFiles} style={{ display: "none" }} /></label>
            {images.length > 0 && <div style={styles.imageGrid}>{images.map((image) => <div key={image.id} style={styles.imageCard}>
              {image.preview && <img src={image.preview} alt="" style={{ width: "100%", height: 86, objectFit: "cover", display: "block" }} />}
              <div title={image.name} style={{ padding: "7px 26px 7px 8px", whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden", fontSize: 11 }}>{image.name}</div>
              <button type="button" aria-label={`Remove ${image.name}`} onClick={() => removeImage(image.id)} style={{ position: "absolute", top: 4, right: 4, width: 23, height: 23, padding: 0, border: 0, borderRadius: 12, cursor: "pointer", background: "rgba(15,23,42,.78)", color: "#fff" }}>×</button>
            </div>)}</div>}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, marginTop: 20 }}><button type="button" onClick={onClose} style={{ ...styles.button, background: "#eef1f5", color: "#344054" }}>Cancel</button><button type="submit" disabled={submitting} style={{ ...styles.button, background: "#2563a8", color: "#fff", opacity: submitting ? .65 : 1 }}>{submitting ? "Submitting…" : "Submit enhancement"}</button></div>
        </form> : <div>
          {loadingHistory ? <div>Loading…</div> : history.length ? history.map((request) => <article key={request.id} style={styles.historyItem}><div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><strong>{request.title}</strong><span style={{ color: "#526276", fontSize: 12 }}>{request.status.replaceAll("_", " ")}</span></div><div style={{ marginTop: 5, color: "#6c7787", fontSize: 12 }}>{request.linked_work_request?.id ? `Work Request ${request.linked_work_request.id}` : request.id}</div></article>) : <div style={{ color: "#697586" }}>No enhancement requests yet.</div>}
          <button type="button" onClick={() => void loadHistory()} style={{ ...styles.button, marginTop: 16, background: "#eef1f5", color: "#344054" }}>Refresh</button>
        </div>}
      </div>
    </section>
  </div>;
}

export interface EnhancementReporterButtonProps extends Omit<EnhancementReporterDialogProps, "open" | "onClose"> {
  readonly label?: string;
  readonly className?: string;
}

export function EnhancementReporterButton({ label = "Suggest an enhancement", className, ...dialogProps }: EnhancementReporterButtonProps) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className={className} onClick={() => setOpen(true)} style={!className ? { ...styles.button, background: "#2563a8", color: "#fff" } : undefined}>{label}</button>
    <EnhancementReporterDialog {...dialogProps} open={open} onClose={() => setOpen(false)} />
  </>;
}

export { createEnhancementReporter, reporterIdentity };
export type { EnhancementReporterClient, EnhancementReporterConfig, EnhancementRequestRecord } from "./reporter";
export const REACT_SDK_IDENTITY = reporterIdentity("react");
