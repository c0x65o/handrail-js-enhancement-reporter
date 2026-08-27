import {
  EnhancementReporterButton,
  EnhancementReporterDialog,
  EnhancementReporterProvider,
  createEnhancementReporter,
  type EnhancementReporterAppearance,
  type EnhancementReporterDialogProps,
  type EnhancementReporterStyle,
} from "@handrail/enhancement-reporter/react";
import type {
  EnhancementBridgeClient,
  EnhancementTransportClient,
} from "@handrail/enhancement-reporter/server";

const transportCompatibility: EnhancementBridgeClient | EnhancementTransportClient | null = null;

const reporter = createEnhancementReporter({ endpoint: "/api/handrail-enhancements" });
const configuredVersion: string | undefined = reporter.appVersion;
const appearance: EnhancementReporterAppearance = {
  themeMode: "dark",
  tokens: { accent: "rebeccapurple", warningText: "#fbc46d", infoText: "#a7c7ff", radius: "4px" },
  style: { zIndex: 20, "--handrail-enhancement-accent": "#7c3aed" } satisfies EnhancementReporterStyle,
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
void transportCompatibility;
void configuredVersion;
