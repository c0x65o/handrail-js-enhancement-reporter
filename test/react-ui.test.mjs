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

  await act(async () => launcher.props.onClick());
  assert.equal(renderer.root.findByProps({ "aria-haspopup": "dialog" }).props["aria-expanded"], true);
  const overlay = renderer.root.findByProps({ "data-handrail-enhancement-reporter": "overlay" });
  assert.equal(overlay.props["data-theme"], "auto");
  assert.equal(overlay.props.style.colorScheme, "inherit");
  await act(async () => renderer.root.findByProps({ "aria-label": "Close enhancement reporter" }).props.onClick());
  assert.equal(renderer.root.findAllByProps({ role: "dialog" }).length, 0);
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
        appearance: { themeMode: "dark", tokens: { accent: "#ff00aa", radius: "4px" } },
      }), { createNodeMock: (element) => element.type === "section" ? dialogNode : new MockElement(String(element.type)) });
    });
    const overlay = renderer.root.findByProps({ "data-handrail-enhancement-reporter": "overlay" });
    assert.equal(overlay.props["data-theme"], "dark");
    assert.equal(overlay.props.style["--handrail-enhancement-accent"], "#ff00aa");
    assert.equal(overlay.props.style["--handrail-enhancement-radius"], "4px");
    assert.equal(overlay.props.style.colorScheme, "dark");
    const dialog = renderer.root.findByProps({ role: "dialog" });
    assert.equal(dialog.props["aria-modal"], "true");
    assert.ok(dialog.props["aria-labelledby"]);
    assert.ok(dialog.props["aria-describedby"]);
    assert.equal(dialog.props.style.width, "min(700px, calc(100vw - 24px))");
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

test("semantic tabs and capability-driven history delegate filters, restore, and clear succeeded", async () => {
  const listCalls = [];
  const restoreCalls = [];
  let clearCalls = 0;
  const dismissed = {
    id: "enh-1", title: "Saved filters", status: "succeeded", status_group: "succeeded",
    terminal: true, dismissed: true, dismissed_at: "2026-08-01T00:00:00Z",
  };
  const sdk = client(async () => discovery({
    user_enabled: true,
    access_level: "user",
    history: {
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
  sdk.dismissSucceeded = async () => { clearCalls += 1; return { dismissed_count: 1 }; };
  sdk.dismiss = async () => { throw new Error("not used"); };
  let renderer;
  await act(async () => { renderer = create(createElement(EnhancementReporterDialog, { open: true, onClose() {}, client: sdk })); });
  const tabs = renderer.root.findAllByProps({ role: "tab" });
  assert.equal(tabs.length, 2);
  let prevented = false;
  await act(async () => tabs[0].props.onKeyDown({ key: "End", preventDefault: () => { prevented = true; } }));
  assert.equal(prevented, true);
  assert.equal(renderer.root.findAllByProps({ role: "tabpanel" }).length, 1);
  assert.deepEqual(listCalls[0], { limit: 10, offset: 0, search: undefined, statusGroup: undefined, sort: "newest", visibility: "active" });

  await act(async () => {
    renderer.root.findByProps({ "aria-label": "Search my requests" }).props.onChange({ target: { value: "filters" } });
    renderer.root.findByProps({ "aria-label": "Enhancement status" }).props.onChange({ target: { value: "succeeded" } });
    renderer.root.findByProps({ "aria-label": "Enhancement sort order" }).props.onChange({ target: { value: "newest" } });
    renderer.root.findByProps({ "aria-label": "Enhancement visibility" }).props.onChange({ target: { value: "all" } });
  });
  const historyForm = renderer.root.findAllByType("form")[0];
  await act(async () => historyForm.props.onSubmit({ preventDefault() {} }));
  assert.deepEqual(listCalls.at(-1), { limit: 10, offset: 0, search: "filters", statusGroup: "succeeded", sort: "newest", visibility: "all" });
  await act(async () => renderer.root.findByProps({ "aria-label": "Restore Saved filters" }).props.onClick());
  assert.deepEqual(restoreCalls, ["enh-1"]);
  await act(async () => renderer.root.find((node) => node.type === "button" && node.children?.includes("Clear succeeded")).props.onClick());
  assert.equal(clearCalls, 1);
  await act(async () => renderer.unmount());
});
