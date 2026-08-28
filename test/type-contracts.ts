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
  EnhancementTransportClient,
} from "@handrail/enhancement-reporter/server";
import {
  createRequestScopedEnhancementReporter,
} from "@handrail/enhancement-reporter/server";

const transportCompatibility: EnhancementTransportClient | null = null;
const requestScoped = createRequestScopedEnhancementReporter<{ session?: string }>({
  apiUrl: "https://handrail.example/api/enhancement-reporting/v1",
  projectId: "project-1",
  capabilityId: "capability-1",
  token: "server-only",
  resolveApplicationSessionToken: (request) => request.session,
});
const requestTransport: Promise<EnhancementTransportClient> = requestScoped.forRequest({ session: "current" });

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
void requestTransport;
void configuredVersion;
