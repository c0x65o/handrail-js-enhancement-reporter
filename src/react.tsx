import { reporterIdentity } from "./identity";

export {
  EnhancementReporterProvider,
  useEnhancementReporter,
} from "./react-provider";
export type { EnhancementReporterProviderProps } from "./react-provider";

export {
  EnhancementReporterButton,
  EnhancementReporterDialog,
} from "./react-ui";
export type {
  EnhancementReporterAppearance,
  EnhancementReporterButtonProps,
  EnhancementReporterDialogProps,
  EnhancementReporterThemeMode,
  EnhancementReporterThemeTokens,
} from "./react-ui";

export { reporterIdentity } from "./identity";
export { createEnhancementReporter } from "./reporter";
export {
  ENHANCEMENT_HISTORY_SORTS,
  ENHANCEMENT_HISTORY_STATUS_GROUPS,
  ENHANCEMENT_HISTORY_VISIBILITIES,
} from "./reporter";
export type {
  EnhancementDismissResult,
  EnhancementDismissSucceededResult,
  EnhancementHistoryListOptions,
  EnhancementHistoryCapabilities,
  EnhancementHistoryQuery,
  EnhancementHistorySort,
  EnhancementHistoryStatusGroup,
  EnhancementHistorySummary,
  EnhancementHistoryVisibility,
  EnhancementReporterClient,
  EnhancementReporterConfig,
  EnhancementReporterDiscovery,
  EnhancementRequestRecord,
  EnhancementNotificationPreference,
  EnhancementNotificationSubscription,
  EnhancementSubmissionResult,
  EnhancementRestoreResult,
} from "./reporter";

export const REACT_SDK_IDENTITY = reporterIdentity("react");
