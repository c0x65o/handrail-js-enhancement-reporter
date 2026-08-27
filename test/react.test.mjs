import assert from "node:assert/strict";
import test from "node:test";

process.env.NODE_ENV = "test";
const { createElement } = await import("react");
const { act, create } = await import("react-test-renderer");
const { EnhancementReporterDialog } = await import("../dist/react.js");

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function pastedPng(name = "clipboard.png") {
  const image = new Blob([
    Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]),
  ], { type: "image/png" });
  Object.defineProperties(image, {
    name: { value: name },
    lastModified: { value: 1 },
  });
  return image;
}

test("the React dialog captures pasted and dropped images once and preserves their source", async () => {
  const submissions = [];
  const client = {
    enabled: true,
    endpoint: "/api/handrail-enhancements",
    notificationsEnabled: true,
    discover: async () => ({
      enhancement_reporting: { enabled: true, user_enabled: false, access_level: null, policy: { cells: { run_work_request: "ask" } } },
      reporter_notifications: { available: true, recipient_hint: "r***@example.com", lifecycles: ["fixed"] },
    }),
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
        notification_subscription: input.notification
          ? { active: true, created: true, recipient_hint: "r***@example.com", subscribed_at: "2026-08-25T12:00:00.000Z" }
          : undefined,
        notification_warning: null,
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
  assert.equal(dialog.props.style.height, "min(900px, calc(100dvh - 40px))");
  assert.equal(dialog.props.style.overflow, "hidden");
  assert.equal(dialog.findAll((node) => node.props.style?.overflow === "auto").length, 1);
  assert.equal(renderer.root.findAll((node) => node.children?.includes("My requests")).length, 0);
  assert.equal(renderer.root.findAllByProps({ role: "alert" }).length, 0);

  await act(async () => renderer.root.findByProps({ "aria-label": "Start work on this request" }).props.onChange({ target: { checked: true } }));
  const notificationCheckbox = renderer.root.findByProps({
    "aria-label": "Email me when this enhancement is fixed",
  });
  assert.equal(notificationCheckbox.props.checked, false);
  await act(async () => notificationCheckbox.props.onChange({ target: { checked: true } }));
  assert.equal(renderer.root.findAllByProps({ type: "email" }).length, 0);

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

  const dropzone = renderer.root.findByProps({ "data-handrail-enhancement-image-dropzone": "true" });
  const dropped = pastedPng("dropped.png");
  const dragData = { types: ["Files"], files: [dropped], dropEffect: "none" };
  let dropPrevented = 0;
  await act(async () => dropzone.props.onDragOver({
    dataTransfer: dragData,
    preventDefault() { dropPrevented += 1; },
  }));
  await act(async () => dropzone.props.onDrop({
    dataTransfer: dragData,
    preventDefault() { dropPrevented += 1; },
  }));
  assert.equal(dropPrevented, 2);
  assert.equal(dragData.dropEffect, "copy");
  assert.equal(renderer.root.findAll((node) => node.props["aria-label"] === "Remove dropped.png").length, 1);

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
  assert.equal(submissions[0].priority, "medium");
  assert.equal(submissions[0].images.length, 2);
  assert.equal(submissions[0].images[0].filename, "clipboard.png");
  assert.equal(submissions[0].images[0].source, "clipboard");
  assert.equal(submissions[0].images[1].filename, "dropped.png");
  assert.equal(submissions[0].images[1].source, "upload");
  assert.deepEqual(submissions[0].automationRequests, { run_work_request: true });
  assert.deepEqual(submissions[0].notification, {
    notifyOnResolution: true,
  });
  assert.match(
    renderer.root.findAllByProps({ role: "status" }).map((node) => node.children.join("")).join(" "),
    /Email updates are enabled/u,
  );
  await act(async () => renderer.unmount());
});

test("the React dialog hides notification consent without a Known User email", async () => {
  const client = {
    enabled: true,
    endpoint: "/api/handrail-enhancements",
    notificationsEnabled: true,
    discover: async () => ({
      enhancement_reporting: { enabled: true, user_enabled: false, access_level: null, policy: { cells: {} } },
      reporter_notifications: { available: false, recipient_hint: null, lifecycles: ["fixed"] },
    }),
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

  assert.doesNotMatch(JSON.stringify(renderer.toJSON()), /Email me when this is fixed/u);
  assert.equal(renderer.root.findAllByProps({ type: "email" }).length, 0);
  await act(async () => renderer.unmount());
});

test("the React dialog preserves My requests compatibility with older enabled-user discovery", async () => {
  const client = {
    enabled: true,
    endpoint: "/api/handrail-enhancements",
    discover: async () => ({ enhancement_reporting: { enabled: true, user_enabled: true, access_level: "user", policy: { cells: { run_work_request: "ask" } } } }),
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
  const startWork = renderer.root.findByProps({ "aria-label": "Start work on this request" });
  await act(async () => startWork.props.onChange({ target: { checked: true } }));
  assert.equal(renderer.root.findAllByProps({ "aria-label": "Deploy to staging" }).length, 0);
  assert.equal(renderer.root.findAllByProps({ "aria-label": "Deploy to production" }).length, 0);
  await act(async () => renderer.unmount());
});

test("history pages on demand, shows deployment versions, and dismisses without cancellation", async () => {
  const listCalls = [];
  const dismissCalls = [];
  const requests = [
    {
      id: "request-1",
      title: "First enhancement",
      status: "succeeded",
      terminal: true,
      linked_work_request: { id: "work-1" },
      release_tracking: {
        auto_commit: { commits: [{ version: "2.0.0" }] },
        environments: [{
          environment: "production",
          deployment_state: "fully_deployed",
          targets: [{ contains_change: true, current_version: "2.0.0" }],
        }],
      },
    },
    {
      id: "request-2",
      title: "Older enhancement",
      status: "succeeded",
      terminal: true,
      linked_work_request: { id: "work-2" },
      release_tracking: { auto_commit: { commits: [{ version: "1.9.0" }] }, environments: [] },
    },
  ];
  const client = {
    enabled: true,
    endpoint: "/api/handrail-enhancements",
    discover: async () => ({ enhancement_reporting: { enabled: true, user_enabled: true, access_level: "user" } }),
    submit: async () => { throw new Error("not used"); },
    list: async ({ limit, offset = 0 }) => {
      listCalls.push({ limit, offset });
      return {
        contract_version: "v1",
        requests: requests.slice(offset, offset + limit),
        pagination: { limit, offset, total: requests.length, has_more: offset + limit < requests.length },
      };
    },
    dismiss: async (requestId) => {
      dismissCalls.push(requestId);
      return { contract_version: "v1", request_id: requestId, dismissed_at: "2026-08-13T20:00:00.000Z", underlying_request_preserved: true };
    },
  };
  let renderer;
  await act(async () => {
    renderer = create(createElement(EnhancementReporterDialog, {
      open: true,
      onClose() {},
      client,
      historyPageSize: 1,
    }));
  });
  const historyTab = renderer.root.find((node) => node.type === "button" && node.children?.includes("My requests"));
  await act(async () => historyTab.props.onClick());
  assert.deepEqual(listCalls, [{ limit: 1, offset: 0 }]);
  assert.equal(renderer.root.findAll((node) => node.children?.includes("Production deployed · v2.0.0")).length, 1);
  const showMore = renderer.root.find((node) => node.type === "button" && node.children?.includes("Show more"));
  await act(async () => showMore.props.onClick());
  assert.deepEqual(listCalls, [{ limit: 1, offset: 0 }, { limit: 1, offset: 1 }]);
  assert.equal(renderer.root.findAll((node) => node.children?.includes("Deployment status unavailable · v1.9.0")).length, 1);
  const dismiss = renderer.root.findByProps({ "aria-label": "Dismiss First enhancement" });
  await act(async () => dismiss.props.onClick());
  assert.deepEqual(dismissCalls, ["request-1"]);
  assert.equal(renderer.root.findAllByProps({ "aria-label": "Dismiss First enhancement" }).length, 0);
  await act(async () => renderer.unmount());
});
