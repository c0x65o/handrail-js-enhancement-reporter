import assert from "node:assert/strict";
import test from "node:test";

process.env.NODE_ENV = "test";
const { createElement } = await import("react");
const { act, create } = await import("react-test-renderer");
const { EnhancementReporterDialog } = await import("../dist/react.js");

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function pastedPng() {
  const image = new Blob([
    Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]),
  ], { type: "image/png" });
  Object.defineProperties(image, {
    name: { value: "clipboard.png" },
    lastModified: { value: 1 },
  });
  return image;
}

test("the React dialog captures a pasted image once and submits it as clipboard input", async () => {
  const submissions = [];
  const client = {
    enabled: true,
    endpoint: "/api/handrail-enhancements",
    discover: async () => ({ enhancement_reporting: { enabled: true, user_enabled: false, access_level: null } }),
    submit: async (input) => {
      submissions.push(input);
      return {
        request: {
          id: "bridge-1",
          title: input.title,
          status: "needs_attention",
          terminal: false,
          linked_work_request: { id: "wr-1" },
        },
        replayed: false,
      };
    },
    list: async () => ({
      contract_version: "v1",
      requests: [],
      pagination: { limit: 20, offset: 0, total: 0, has_more: false },
    }),
  };
  let renderer;
  await act(async () => {
    renderer = create(createElement(EnhancementReporterDialog, {
      open: true,
      onClose() {},
      client,
    }));
  });

  const pasteTargets = renderer.root.findAll((node) => (
    typeof node.type === "string" && typeof node.props.onPaste === "function"
  ));
  assert.equal(pasteTargets.length, 1, "paste should be handled at one dialog boundary");
  const dialog = renderer.root.findByProps({ role: "dialog" });
  assert.equal(dialog.props.style.height, "min(620px, calc(100vh - 40px))");
  assert.equal(dialog.props.style.overflow, "hidden");
  assert.equal(dialog.findAll((node) => node.props.style?.overflow === "auto").length, 1);
  assert.equal(renderer.root.findAll((node) => node.children?.includes("My requests")).length, 0);
  assert.equal(renderer.root.findAllByProps({ role: "alert" }).length, 0);

  let prevented = 0;
  await act(async () => {
    pasteTargets[0].props.onPaste({
      clipboardData: {
        items: [{ kind: "file", type: "image/png", getAsFile: pastedPng }],
      },
      preventDefault() { prevented += 1; },
    });
  });
  assert.equal(prevented, 1);
  assert.equal(renderer.root.findAll((node) => node.props["aria-label"] === "Remove clipboard.png").length, 1);

  const title = renderer.root.findByProps({ placeholder: "What should be improved?" });
  const description = renderer.root.findByProps({
    placeholder: "Describe the outcome you want. You can paste screenshots here.",
  });
  await act(async () => {
    title.props.onChange({ target: { value: "Saved views" } });
    description.props.onChange({ target: { value: "Let me save and share filters." } });
  });
  const form = renderer.root.findByType("form");
  await act(async () => {
    await form.props.onSubmit({ preventDefault() {} });
  });

  assert.equal(submissions.length, 1);
  assert.equal(submissions[0].images.length, 1);
  assert.equal(submissions[0].images[0].filename, "clipboard.png");
  assert.equal(submissions[0].images[0].source, "clipboard");
  await act(async () => renderer.unmount());
});

test("the React dialog silently reveals My requests only for enabled enhancement users", async () => {
  const client = {
    enabled: true,
    endpoint: "/api/handrail-enhancements",
    discover: async () => ({ enhancement_reporting: { enabled: true, user_enabled: true, access_level: "user" } }),
    submit: async () => { throw new Error("not used"); },
    list: async () => ({
      contract_version: "v1",
      requests: [],
      pagination: { limit: 20, offset: 0, total: 0, has_more: false },
    }),
  };
  let renderer;
  await act(async () => {
    renderer = create(createElement(EnhancementReporterDialog, {
      open: true,
      onClose() {},
      client,
    }));
  });
  assert.equal(renderer.root.findAll((node) => node.children?.includes("My requests")).length, 1);
  assert.equal(renderer.root.findAllByProps({ role: "alert" }).length, 0);
  await act(async () => renderer.unmount());
});
