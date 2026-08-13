import {
  GENERATED_PACKAGE_COMMIT,
  GENERATED_PACKAGE_NAME,
  GENERATED_PACKAGE_RELEASE_REF,
  GENERATED_PACKAGE_VERSION,
} from "./generated/release";

export const SDK_NAME = GENERATED_PACKAGE_NAME;
export const SDK_VERSION = GENERATED_PACKAGE_VERSION;
export const SDK_COMMIT = GENERATED_PACKAGE_COMMIT;
export const SDK_RELEASE_REF = GENERATED_PACKAGE_RELEASE_REF;
export const ENHANCEMENT_SOURCE = "web_enhancement_reporter" as const;

export function reporterIdentity(runtime: "browser" | "react" | "node") {
  return Object.freeze({
    package: SDK_NAME,
    version: SDK_VERSION,
    commit: SDK_COMMIT || null,
    ref: SDK_RELEASE_REF,
    runtime,
  });
}
