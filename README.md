# @handrail/enhancement-reporter

Authenticated, web-only customer enhancement requests for Handrail. The package provides a browser client, a ready-to-use React dialog, and a framework-neutral same-origin server handler backed by `@handrail/mcp`.

Version `0.1.x` deliberately creates only **Pending Work Requests**. It cannot request staging or production delivery. Every request remains scoped to the authenticated Known User who submitted it.

## Install

Install the latest available reporter and compatible MCP peer directly from
their canonical GitHub repositories; neither package should be assumed to
exist in the npm registry:

```sh
npm install \
  '@handrail/enhancement-reporter@github:c0x65o/handrail-js-enhancement-reporter' \
  '@handrail/mcp@github:c0x65o/handrail-mcp'
```

You do not need a Handrail Maintenance commit hash, tag, or dependency pin
before implementing. Commit the application manifest and refreshed lockfile
together. The lockfile records the resolved revisions so Owner Maintenance can
report version and commit drift later.

The browser entry never accepts or transmits a Handrail bridge credential. Mount the server handler on the same origin, behind your normal application authentication boundary, and keep the MCP credential in server-only environment variables.

## Server route

The example below fits a Next.js catch-all route at `app/api/handrail-enhancements/[[...path]]/route.ts`. The same handler works with any framework that supplies Web `Request` and `Response` objects.

```ts
import { createSameOriginEnhancementReporterHandler } from "@handrail/enhancement-reporter/server";

const handler = createSameOriginEnhancementReporterHandler({
  routeBasePath: "/api/handrail-enhancements",
  apiUrl: process.env.HANDRAIL_ASSISTANT_BRIDGE_API_URL!,
  projectId: process.env.HANDRAIL_ASSISTANT_BRIDGE_PROJECT_ID!,
  capabilityId: process.env.HANDRAIL_ASSISTANT_BRIDGE_CAPABILITY_ID!,
  token: process.env.HANDRAIL_ASSISTANT_BRIDGE_TOKEN!,
  contractVersion: "v1",
  async resolveApplicationSessionToken(request) {
    // Read and validate your authenticated HttpOnly app session here.
    // Return its opaque raw token. Handrail hashes and verifies it against the
    // Known Users session source configured for this exact environment.
    return readAuthenticatedSessionToken(request);
  },
});

export const GET = handler;
export const POST = handler;
```

The handler rejects missing Known User sessions and cross-site requests. It forwards neither cookies nor application authorization headers. Keep the route behind your framework's normal CSRF/session protections as well.

## React UI

```tsx
import {
  EnhancementReporterButton,
  EnhancementReporterProvider,
} from "@handrail/enhancement-reporter/react";

export function AccountMenu() {
  return (
    <EnhancementReporterProvider
      config={{
        endpoint: "/api/handrail-enhancements",
        appVersion: import.meta.env.VITE_APP_VERSION,
      }}
    >
      <EnhancementReporterButton label="Suggest an enhancement" />
    </EnhancementReporterProvider>
  );
}
```

The dialog supports file upload and direct image paste from the clipboard. Accepted formats are PNG, JPEG, GIF, and WebP, with a maximum of 4 images, 5 MiB per image, and 15 MiB total. Both the browser and Handrail validate image signatures and limits.

The **My requests** tab lists only requests owned by the current authenticated principal. Returned attachment URLs also pass through the same principal-scoped route.

## Headless browser API

```ts
import { createEnhancementReporter } from "@handrail/enhancement-reporter";

const reporter = createEnhancementReporter({
  endpoint: "/api/handrail-enhancements",
  appVersion: "2026.08.13",
});

await reporter.submit({
  title: "Add a saved filter view",
  description: "Let me save the current filters and share the view with my team.",
  images: [{ data: file, filename: file.name, source: "upload" }],
});

const mine = await reporter.list();
const current = await reporter.lookup(mine.requests[0].id);
const release = await reporter.releaseStatus(current.id);
```

`releaseStatus` reports the eventual full commit SHA/version and its deployment state once staff approve and deliver the linked Work Request.

## Security contract

- Browser transport is same-origin only and always sends `credentials: "same-origin"`.
- The application resolves a session token afresh for every request; no anonymous or static-user fallback exists.
- Handrail resolves the session through Known Users and scopes submit, list, lookup, attachment, cancellation, and release status to that principal.
- Server code overwrites delivery and automation fields. Version `0.1.x` always submits a non-executing, pending enhancement Work Request.
- MCP/API credentials remain server-only.
