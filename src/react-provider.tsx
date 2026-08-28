import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";

import {
  createEnhancementReporter,
  type EnhancementReporterClient,
  type EnhancementReporterConfig,
} from "./reporter";

const ReporterContext = createContext<EnhancementReporterClient | null>(null);

export interface EnhancementReporterProviderProps {
  readonly children: ReactNode;
  readonly client?: EnhancementReporterClient;
  readonly config?: EnhancementReporterConfig;
}

export function EnhancementReporterProvider({
  children,
  client,
  config,
}: EnhancementReporterProviderProps) {
  const value = useMemo(
    () => client || createEnhancementReporter(config),
    [
      client,
      config?.endpoint,
      config?.enabled,
      config?.appVersion,
      config?.conversationId,
      config?.reporterEmail,
      config?.notificationsEnabled,
      config?.fetch,
    ],
  );
  return <ReporterContext.Provider value={value}>{children}</ReporterContext.Provider>;
}

export function useOptionalEnhancementReporter(): EnhancementReporterClient | null {
  return useContext(ReporterContext);
}

export function useEnhancementReporter(): EnhancementReporterClient {
  const client = useOptionalEnhancementReporter();
  if (!client) {
    throw new Error(
      "useEnhancementReporter must be used inside EnhancementReporterProvider",
    );
  }
  return client;
}
