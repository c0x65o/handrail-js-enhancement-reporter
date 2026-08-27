import react = require("@handrail/enhancement-reporter/react");

const reporter = react.createEnhancementReporter({ endpoint: "/api/handrail-enhancements" });
const configuredVersion: string | undefined = reporter.appVersion;
const props: react.EnhancementReporterDialogProps = {
  open: false,
  onClose() {},
  client: reporter,
};
const appearance: react.EnhancementReporterAppearance = {
  tokens: { warningText: "#b54708" },
  style: { "--handrail-enhancement-info-text": "#175cd3" } satisfies react.EnhancementReporterStyle,
};
void react.EnhancementReporterProvider;
void react.EnhancementReporterButton;
void react.EnhancementReporterDialog;
void props;
void appearance;
void configuredVersion;
