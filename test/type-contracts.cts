import react = require("@handrail/enhancement-reporter/react");

const reporter = react.createEnhancementReporter({ endpoint: "/api/handrail-enhancements" });
const configuredVersion: string | undefined = reporter.appVersion;
const props: react.EnhancementReporterDialogProps = {
  open: false,
  onClose() {},
  client: reporter,
};
void react.EnhancementReporterProvider;
void react.EnhancementReporterButton;
void react.EnhancementReporterDialog;
void props;
void configuredVersion;
