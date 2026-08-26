import react = require("@handrail/enhancement-reporter/react");

const reporter = react.createEnhancementReporter({ endpoint: "/api/handrail-enhancements" });
const props: react.EnhancementReporterDialogProps = {
  open: false,
  onClose() {},
  client: reporter,
};
void react.EnhancementReporterProvider;
void react.EnhancementReporterButton;
void react.EnhancementReporterDialog;
void props;
