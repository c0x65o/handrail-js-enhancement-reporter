import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

test("React packaged and headless exports are available to ESM and CommonJS consumers", async () => {
  const esm = await import("../dist/react.js");
  const require = createRequire(import.meta.url);
  const cjs = require("../dist/react.cjs");
  for (const name of [
    "EnhancementReporterProvider",
    "useEnhancementReporter",
    "EnhancementReporterButton",
    "EnhancementReporterDialog",
    "createEnhancementReporter",
  ]) {
    assert.equal(typeof esm[name], "function", `${name} ESM export`);
    assert.equal(typeof cjs[name], "function", `${name} CommonJS export`);
  }
});
