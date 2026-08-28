import assert from "node:assert/strict";
import test from "node:test";

process.env.NODE_ENV = "test";
const { createElement } = await import("react");
const { act, create } = await import("react-test-renderer");
const {
  EnhancementReporterButton,
  EnhancementReporterDialog,
} = await import("../dist/react.js");

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function discovery(extra = {}) {
  return {
    enhancement_reporting: {
      enabled: true,
      user_enabled: false,
      access_level: null,
      policy: { cells: {} },
      ...extra,
    },
  };
}

function client(discover = async () => discovery()) {
  return {
    enabled: true,
    endpoint: "/api/handrail-enhancements",
    discover,
    submit: async () => { throw new Error("not used"); },
    list: async () => ({
      contract_version: "v1",
      requests: [],
      pagination: { limit: 10, offset: 0, total: 0, has_more: false },
    }),
  };
}

test("the packaged UI is opt-in and the launcher mounts a separate themed dialog", async () => {
  let renderer;
  await act(async () => {
    renderer = create(createElement(EnhancementReporterButton, {
      client: client(),
      label: "Suggest it",
    }));
  });
  assert.equal(renderer.root.findAllByProps({ role: "dialog" }).length, 0);
  const launcher = renderer.root.findByProps({ "aria-haspopup": "dialog" });
  assert.equal(launcher.props["aria-expanded"], false);
  assert.equal(launcher.props.style["--handrail-enhancement-accent"], "light-dark(#2563eb, #78a9ff)");
  assert.equal(launcher.props.style.background, "var(--handrail-enhancement-accent)");

  await act(async () => launcher.props.onClick());
  assert.equal(renderer.root.findByProps({ "aria-haspopup": "dialog" }).props["aria-expanded"], true);
  const overlay = renderer.root.findByProps({ "data-handrail-enhancement-reporter": "overlay" });
  assert.equal(overlay.props["data-theme"], "auto");
  assert.equal(overlay.props.style.colorScheme, "inherit");
  assert.equal(overlay.props.style["--handrail-enhancement-accent"], "light-dark(#2563eb, #78a9ff)");
  assert.equal(overlay.props.style["--handrail-enhancement-radius"], "12px");
  assert.equal(overlay.props.style["--handrail-enhancement-warning-text"], "light-dark(#b54708, #fbc46d)");
  assert.equal(overlay.props.style["--handrail-enhancement-info-text"], "light-dark(#175cd3, #a7c7ff)");
  assert.equal(overlay.props.style["--handrail-enhancement-font-family"], '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif');
  assert.equal(overlay.props.style.backdropFilter, "blur(3px)");
  await act(async () => renderer.root.findByProps({ "aria-label": "Close enhancement reporter" }).props.onClick());
  assert.equal(renderer.root.findAllByProps({ role: "dialog" }).length, 0);
  await act(async () => renderer.unmount());
});

test("a controlled host theme can switch the packaged UI from light to dark", async () => {
  const dialog = (themeMode) => createElement(EnhancementReporterDialog, {
    open: true,
    onClose: () => undefined,
    client: client(),
    appearance: { themeMode },
  });
  let renderer;
  await act(async () => { renderer = create(dialog("light")); });

  let overlay = renderer.root.findByProps({ "data-handrail-enhancement-reporter": "overlay" });
  assert.equal(overlay.props["data-theme"], "light");
  assert.equal(overlay.props.style.colorScheme, "light");
  assert.equal(overlay.props.style["--handrail-enhancement-accent"], "#2563eb");
  assert.equal(overlay.props.style["--handrail-enhancement-surface"], "#ffffff");

  await act(async () => { renderer.update(dialog("dark")); });
  overlay = renderer.root.findByProps({ "data-handrail-enhancement-reporter": "overlay" });
  assert.equal(overlay.props["data-theme"], "dark");
  assert.equal(overlay.props.style.colorScheme, "dark");
  assert.equal(overlay.props.style["--handrail-enhancement-accent"], "#78a9ff");
  assert.equal(overlay.props.style["--handrail-enhancement-surface"], "#151a23");

  await act(async () => renderer.unmount());
});

test("appearance, responsive dialog semantics, focus containment, Escape, overlay close, and focus restoration are wired", async () => {
  const originals = {
    document: globalThis.document,
    HTMLElement: globalThis.HTMLElement,
    requestAnimationFrame: globalThis.requestAnimationFrame,
    cancelAnimationFrame: globalThis.cancelAnimationFrame,
  };
  let fakeDocument;
  class MockElement {
    constructor(name) { this.name = name; }
    focus() { fakeDocument.activeElement = this; }
    getAttribute() { return null; }
  }
  const previous = new MockElement("previous");
  const first = new MockElement("first");
  const last = new MockElement("last");
  const dialogNode = new MockElement("dialog");
  dialogNode.querySelector = () => first;
  dialogNode.querySelectorAll = () => [first, last];
  fakeDocument = { activeElement: previous, getElementById: () => null };
  globalThis.document = fakeDocument;
  globalThis.HTMLElement = MockElement;
  globalThis.requestAnimationFrame = (callback) => { callback(0); return 1; };
  globalThis.cancelAnimationFrame = () => undefined;
  let closed = 0;
  let renderer;
  try {
    await act(async () => {
      renderer = create(createElement(EnhancementReporterDialog, {
        open: true,
        onClose: () => { closed += 1; },
        client: client(),
        appearance: { themeMode: "dark", tokens: { accent: "#ff00aa", radius: "4px" }, style: { "--handrail-enhancement-accent": "#b93815" } },
      }), { createNodeMock: (element) => element.type === "section" ? dialogNode : new MockElement(String(element.type)) });
    });
    const overlay = renderer.root.findByProps({ "data-handrail-enhancement-reporter": "overlay" });
    assert.equal(overlay.props["data-theme"], "dark");
    assert.equal(overlay.props.style["--handrail-enhancement-accent"], "#b93815");
    assert.equal(overlay.props.style["--handrail-enhancement-radius"], "4px");
    assert.equal(overlay.props.style.colorScheme, "dark");
    const dialog = renderer.root.findByProps({ role: "dialog" });
    assert.equal(dialog.props["aria-modal"], "true");
    assert.ok(dialog.props["aria-labelledby"]);
    assert.ok(dialog.props["aria-describedby"]);
    assert.equal(dialog.props.style.width, "min(1560px, calc(100vw - 24px))");
    assert.equal(dialog.props.style.height, "min(720px, calc(100dvh - 16px))");
    assert.equal(renderer.root.findAllByProps({ "data-handrail-enhancement-report-layout": "true" }).length, 1);
    assert.equal(renderer.root.findAllByProps({ "data-handrail-enhancement-context": "true" }).length, 1);
    assert.equal(renderer.root.findByProps({ "data-handrail-enhancement-report-panel": "true" }).props.style.display, "flex");
    assert.equal(renderer.root.findByProps({ "data-handrail-enhancement-report-form": "true" }).props.style.flex, "1 1 auto");
    assert.equal(renderer.root.findByProps({ "data-handrail-enhancement-report-layout": "true" }).props.style.flex, "1 1 auto");
    assert.match(renderer.root.findByProps({ "data-handrail-enhancement-report-details": "true" }).props.style.gridTemplateRows, /minmax\(150px, 1\.3fr\)/u);
    assert.equal(renderer.root.findByProps({ placeholder: "Describe the outcome you want. You can paste screenshots here." }).props.style.height, "100%");
    assert.equal(renderer.root.findByProps({ "data-handrail-enhancement-image-dropzone": "true" }).props.style.minHeight, 132);
    const renderedDialog = JSON.stringify(renderer.toJSON());
    assert.match(renderedDialog, /Attached context/);
    assert.doesNotMatch(renderedDialog, /"Build"/);
    const responsiveCss = renderer.root.findByType("style").children.join("");
    assert.match(responsiveCss, /@media \(max-width: 1100px\)/);
    assert.match(responsiveCss, /data-handrail-enhancement-history-row/);
    assert.match(responsiveCss, /data-handrail-enhancement-report-form/);
    assert.equal(fakeDocument.activeElement, first);
    let prevented = false;
    fakeDocument.activeElement = last;
    dialog.props.onKeyDown({ key: "Tab", shiftKey: false, preventDefault: () => { prevented = true; } });
    assert.equal(prevented, true);
    assert.equal(fakeDocument.activeElement, first);
    fakeDocument.activeElement = first;
    dialog.props.onKeyDown({ key: "Tab", shiftKey: true, preventDefault() {} });
    assert.equal(fakeDocument.activeElement, last);
    dialog.props.onKeyDown({ key: "Escape", preventDefault() {} });
    assert.equal(closed, 1);
    overlay.props.onMouseDown({ target: overlay, currentTarget: overlay });
    assert.equal(closed, 2);
    await act(async () => renderer.unmount());
    assert.equal(fakeDocument.activeElement, previous);
  } finally {
    globalThis.document = originals.document;
    globalThis.HTMLElement = originals.HTMLElement;
    globalThis.requestAnimationFrame = originals.requestAnimationFrame;
    globalThis.cancelAnimationFrame = originals.cancelAnimationFrame;
  }
});

test("image validation rejects unsupported uploads before delegating to the client", async () => {
  let renderer;
  await act(async () => {
    renderer = create(createElement(EnhancementReporterDialog, {
      open: true,
      onClose() {},
      client: client(),
    }));
  });
  const input = renderer.root.findByProps({ "aria-label": "Choose enhancement images" });
  await act(async () => input.props.onChange({
    target: { files: [{ type: "text/plain", name: "notes.txt", size: 4 }], value: "notes.txt" },
  }));
  assert.match(renderer.root.findByProps({ role: "alert" }).children.join(""), /PNG, JPEG, GIF, or WebP/);
  await act(async () => renderer.unmount());
});

test("an in-flight submission cannot be dismissed accidentally", async () => {
  let finishSubmission;
  let submittedInput;
  let closed = 0;
  const sdk = client();
  sdk.submit = (input) => new Promise((resolve) => {
    submittedInput = input;
    finishSubmission = resolve;
  });
  let renderer;
  await act(async () => {
    renderer = create(createElement(EnhancementReporterDialog, {
      open: true,
      onClose: () => { closed += 1; },
      client: sdk,
      appVersion: "2.0.0",
    }));
  });
  await act(async () => {
    renderer.root.findByProps({ placeholder: "What should be improved?" }).props.onChange({ target: { value: "Saved views" } });
    renderer.root.findByProps({ placeholder: "Describe the outcome you want. You can paste screenshots here." }).props.onChange({ target: { value: "Keep my filters across sessions." } });
  });

  await act(async () => {
    renderer.root.findByType("form").props.onSubmit({ preventDefault() {} });
    await Promise.resolve();
  });
  const dialog = renderer.root.findByProps({ role: "dialog" });
  const overlay = renderer.root.findByProps({ "data-handrail-enhancement-reporter": "overlay" });
  const closeButton = renderer.root.findByProps({ "aria-label": "Close enhancement reporter" });
  assert.equal(dialog.props["aria-busy"], true);
  assert.equal(closeButton.props.disabled, true);
  assert.equal(submittedInput.priority, "medium");
  assert.equal(submittedInput.context.appVersion, "2.0.0");
  dialog.props.onKeyDown({ key: "Escape", preventDefault() {} });
  overlay.props.onMouseDown({ target: overlay, currentTarget: overlay });
  assert.equal(closed, 0);

  await act(async () => {
    finishSubmission({
      request: { id: "enh-1", title: "Saved views", status: "pending", terminal: false },
      replayed: false,
    });
    await Promise.resolve();
  });
  assert.equal(renderer.root.findByProps({ role: "dialog" }).props["aria-busy"], false);
  await act(async () => renderer.root.findByProps({ "aria-label": "Close enhancement reporter" }).props.onClick());
  assert.equal(closed, 1);
  await act(async () => renderer.unmount());
});

test("Default Known Users receive capability-driven history without automation access", async () => {
  const listCalls = [];
  const restoreCalls = [];
  const dismissed = {
    id: "enh-1", title: "Saved filters", status: "succeeded", status_group: "succeeded",
    description: "Let me save and reuse a filter.", created_at: "2026-08-01T00:00:00Z",
    terminal: true, dismissed: true, dismissed_at: "2026-08-01T00:00:00Z",
  };
  const sdk = client(async () => discovery({
    user_enabled: false,
    access_level: null,
    history: {
      enabled: true,
      search: true,
      status_groups: ["succeeded"],
      sorts: ["oldest", "newest"],
      visibilities: ["dismissed", "active", "all"],
      restore: true,
      dismiss_succeeded: true,
    },
  }));
  sdk.list = async (options) => {
    listCalls.push(options);
    return { contract_version: "v1", requests: [dismissed], pagination: { limit: options.limit, offset: 0, total: 1, has_more: false }, summary: { total: 1, needs_attention: 0, in_progress: 0, succeeded: 1, closed: 0 } };
  };
  sdk.restore = async (id) => { restoreCalls.push(id); return { request_id: id }; };
  sdk.dismiss = async () => { throw new Error("not used"); };
  let renderer;
  await act(async () => { renderer = create(createElement(EnhancementReporterDialog, { open: true, onClose() {}, client: sdk })); });
  const tabs = renderer.root.findAllByProps({ role: "tab" });
  assert.equal(tabs.length, 2);
  let prevented = false;
  await act(async () => tabs[0].props.onKeyDown({ key: "End", preventDefault: () => { prevented = true; } }));
  assert.equal(prevented, true);
  assert.equal(renderer.root.findAllByProps({ role: "tabpanel" }).length, 1);
  assert.equal(renderer.root.findByProps({ role: "dialog" }).props.style.height, "min(720px, calc(100dvh - 16px))");
  assert.equal(renderer.root.findByProps({ "data-handrail-enhancement-content": "history" }).props.style.overflow, "hidden");
  assert.equal(renderer.root.findByProps({ role: "table" }).props["aria-label"], "Enhancement requests");
  assert.equal(renderer.root.findAllByProps({ "data-handrail-enhancement-history-row": "true" }).length, 1);
  assert.deepEqual(renderer.root.findByProps({ "aria-label": "Enhancement visibility" }).findAllByType("button").map((button) => button.children.join("")), ["Archived", "Active", "All"]);
  assert.equal(renderer.root.findAll((node) => node.type === "button" && node.children?.some((child) => typeof child === "string" && child.startsWith("Clear succeeded"))).length, 0);
  await act(async () => renderer.root.findByProps({ "aria-label": "View Saved filters" }).props.onClick());
  assert.equal(renderer.root.findAllByProps({ "data-handrail-enhancement-history-detail": "true" }).length, 1);
  assert.deepEqual(listCalls[0], { limit: 10, offset: 0, search: undefined, statusGroup: undefined, sort: "newest", visibility: "active" });

  await act(async () => {
    renderer.root.findByProps({ "aria-label": "Search my requests" }).props.onChange({ target: { value: "filters" } });
    renderer.root.findByProps({ "aria-label": "Enhancement status" }).findAllByType("button")[1].props.onClick();
    renderer.root.findByProps({ "aria-label": "Enhancement sort order" }).props.onChange({ target: { value: "newest" } });
    renderer.root.findByProps({ "aria-label": "Enhancement visibility" }).findAllByType("button")[2].props.onClick();
  });
  const historyForm = renderer.root.findAllByType("form")[0];
  await act(async () => historyForm.props.onSubmit({ preventDefault() {} }));
  assert.deepEqual(listCalls.at(-1), { limit: 10, offset: 0, search: "filters", statusGroup: "succeeded", sort: "newest", visibility: "all" });
  await act(async () => renderer.root.findByProps({ "aria-label": "Restore Saved filters" }).props.onClick());
  assert.deepEqual(restoreCalls, ["enh-1"]);
  await act(async () => renderer.unmount());
});

test("archiving refreshes enhancement filter counts and refills the current page", async () => {
  let archived = false;
  const listCalls = [];
  const request = {
    id: "enh-active", title: "Saved views", status: "succeeded", status_group: "succeeded",
    description: "Let me save and reuse a view.", created_at: "2026-08-01T00:00:00Z",
    terminal: true, dismissed: false, dismissed_at: null,
  };
  const sdk = client(async () => discovery({
    history: {
      enabled: true,
      search: false,
      status_groups: ["succeeded"],
      sorts: ["newest"],
      visibilities: ["active", "dismissed"],
      restore: true,
      dismiss_succeeded: true,
    },
  }));
  sdk.list = async (options) => {
    listCalls.push(options);
    return {
      contract_version: "v1",
      requests: archived ? [] : [request],
      pagination: { limit: options.limit, offset: 0, total: archived ? 0 : 1, has_more: false },
      summary: { total: archived ? 0 : 1, needs_attention: 0, in_progress: 0, succeeded: archived ? 0 : 1, closed: 0 },
    };
  };
  sdk.dismiss = async (id) => {
    assert.equal(id, "enh-active");
    archived = true;
    return { contract_version: "v1", request_id: id, dismissed: true, dismissed_at: "2026-08-27T00:00:00Z", underlying_request_preserved: true };
  };

  let renderer;
  await act(async () => { renderer = create(createElement(EnhancementReporterDialog, { open: true, onClose() {}, client: sdk })); });
  await act(async () => {
    renderer.root.findAllByProps({ role: "tab" })[1].props.onClick();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  let statusButtons = renderer.root.findByProps({ "aria-label": "Enhancement status" }).findAllByType("button");
  assert.equal(statusButtons[0].findByType("span").children.join(""), "1");
  assert.equal(statusButtons[1].findByType("span").children.join(""), "1");

  await act(async () => {
    renderer.root.findByProps({ "aria-label": "Archive Saved views" }).props.onClick();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  assert.equal(listCalls.length, 2);
  statusButtons = renderer.root.findByProps({ "aria-label": "Enhancement status" }).findAllByType("button");
  assert.equal(statusButtons[0].findByType("span").children.join(""), "0");
  assert.equal(statusButtons[1].findByType("span").children.join(""), "0");
  assert.equal(renderer.root.findAllByProps({ "data-handrail-enhancement-history-row": "true" }).length, 0);
  await act(async () => renderer.unmount());
});

test("a submitted enhancement immediately invalidates and refreshes previously loaded history", async () => {
  const requests = [{
    id: "enh-existing", title: "Existing request", description: "Already here.",
    status: "running", status_group: "in_progress", terminal: false,
    dismissed: false, dismissed_at: null, created_at: "2026-08-26T00:00:00Z",
  }];
  const listCalls = [];
  const sdk = client(async () => discovery({
    history: {
      enabled: true,
      search: true,
      status_groups: ["needs_attention", "in_progress", "succeeded", "closed"],
      sorts: ["newest", "oldest"],
      visibilities: ["active", "dismissed", "all"],
      restore: true,
      dismiss_succeeded: true,
    },
  }));
  sdk.list = async (options) => {
    listCalls.push(options);
    return {
      contract_version: "v1",
      requests: [...requests],
      pagination: {
        limit: options.limit,
        offset: 0,
        total: requests.length,
        has_more: false,
      },
      summary: {
        total: requests.length,
        needs_attention: 0,
        in_progress: requests.length,
        succeeded: 0,
        closed: 0,
      },
    };
  };
  sdk.submit = async (input) => {
    const request = {
      id: "enh-new", title: input.title, description: input.description,
      status: "running", status_group: "in_progress", terminal: false,
      dismissed: false, dismissed_at: null, created_at: "2026-08-27T00:00:00Z",
    };
    requests.unshift(request);
    return { request, replayed: false };
  };

  let renderer;
  await act(async () => {
    renderer = create(createElement(EnhancementReporterDialog, {
      open: true,
      onClose() {},
      client: sdk,
    }));
  });
  await act(async () => {
    renderer.root.findAllByProps({ role: "tab" })[1].props.onClick();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  assert.equal(listCalls.length, 1);
  assert.equal(renderer.root.findAllByProps({ "data-handrail-enhancement-history-row": "true" }).length, 1);

  await act(async () => renderer.root.findAllByProps({ role: "tab" })[0].props.onClick());
  await act(async () => {
    renderer.root.findByProps({ placeholder: "What should be improved?" }).props.onChange({
      target: { value: "Newly submitted request" },
    });
    renderer.root.findByProps({
      placeholder: "Describe the outcome you want. You can paste screenshots here.",
    }).props.onChange({ target: { value: "It should appear without a manual refresh." } });
  });
  await act(async () => renderer.root.findByType("form").props.onSubmit({ preventDefault() {} }));
  assert.equal(renderer.root.findByProps({ "aria-label": "2 total" }).children.join(""), "2");

  await act(async () => {
    renderer.root.findAllByProps({ role: "tab" })[1].props.onClick();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  assert.equal(listCalls.length, 2);
  assert.equal(renderer.root.findAllByProps({ "data-handrail-enhancement-history-row": "true" }).length, 2);
  assert.equal(renderer.root.findAllByProps({ "aria-label": "View Newly submitted request" }).length, 1);
  await act(async () => renderer.unmount());
});
