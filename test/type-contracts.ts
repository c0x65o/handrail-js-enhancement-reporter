import type { CSSProperties } from "react";
import {
  EnhancementReporterButton,
  EnhancementReporterDialog,
  EnhancementReporterProvider,
  createEnhancementReporter,
  type EnhancementReporterAppearance,
  type EnhancementReporterDialogProps,
} from "@handrail/enhancement-reporter/react";

const reporter = createEnhancementReporter({ endpoint: "/api/handrail-enhancements" });
const appearance: EnhancementReporterAppearance = {
  themeMode: "dark",
  tokens: { accent: "rebeccapurple", radius: "4px" },
  style: { zIndex: 20 } satisfies CSSProperties,
};
const legacyProps: EnhancementReporterDialogProps = {
  open: true,
  onClose() {},
  client: reporter,
  appVersion: "1.0.0",
  heading: "Ideas",
  historyPageSize: 20,
};
void EnhancementReporterProvider;
void EnhancementReporterButton;
void EnhancementReporterDialog;
void appearance;
void legacyProps;
