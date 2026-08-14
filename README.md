# @handrail/enhancement-reporter

Authenticated, web-only customer enhancement requests for Handrail. The package provides a browser client, a ready-to-use React dialog, and a framework-neutral same-origin server handler with its own narrow Handrail REST transport. It does not require `@handrail/mcp`.

Version `0.2.x` applies the enhancement-specific Default, User, or Full Access matrix. Pending stays non-executing, Ask renders customer checkboxes, and Always applies automatically. Staging and production remain bounded by that matrix and Handrail's normal deployment gates. Every request stays scoped to the authenticated Known User who submitted it.

## Install

Install the latest available reporter directly from its canonical GitHub
repository; the package should not be assumed to exist in the npm registry:

```sh
npm install \
  '@handrail/enhancement-reporter@github:c0x65o/handrail-js-enhancement-reporter'
```

You do not need a Handrail Maintenance commit hash, tag, or dependency pin
before implementing. Commit the application manifest and refreshed lockfile
together. The lockfile records the resolved revisions so Owner Maintenance can
report version and commit drift later.

Use these Git dependencies directly. Do not vendor reporter tarballs, copied
package directories, or local file dependencies. Maintenance compares the
resolved Git commit with this repository and can move every installed project
to the same current revision through its controlled update plan.

The enhancement reporter stands on its own; `@handrail/mcp` remains a separate AI-tool connector and is not an application integration dependency. The browser entry never accepts or transmits a Handrail bridge credential. Mount the server handler on the same origin, behind your normal application authentication boundary, and keep the bridge credential in server-only environment variables.

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

When an action is configured as **Ask**, the dialog renders its checkbox. A staging or production checkbox is enabled only when the Work Request will start. **Always** actions do not require a customer checkbox; **Pending** Work Request policy keeps delivery unavailable.

Every authenticated Known User may submit while the runtime enhancement switch is enabled. The dialog calls the same-origin policy route before rendering navigation. Users with an explicit Enhancement Automation User or Full Access tracking assignment receive the **My requests** tab; unassigned users see only the submission form, without an access warning. The tab lists only requests owned by the current authenticated principal, and returned attachment URLs pass through the same principal-scoped route.

**My requests** initially loads the 10 newest requests and offers **Show more** for older pages. Each row summarizes the strongest release evidence available, preferring production and then staging, and includes the deployed application version when Handrail has recorded one. Missing release tracking or environment targets display **Deployment status unavailable** rather than **Not deployed**. **Dismiss** removes a row from that principal's default history; it never deletes, cancels, or changes the linked Work Request. Set `historyPageSize` on `EnhancementReporterDialog` to use another page size from 1 through 50.

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
await reporter.dismiss(current.id);
```

`list({ limit, offset })` is newest-first and returns bounded pagination metadata. `releaseStatus` reports the eventual full commit SHA/version and its deployment state once staff approve and deliver the linked Work Request. `dismiss` hides the row from the current principal's subsequent lists while preserving the canonical request and linked Work Request.

## Security contract

- Browser transport is same-origin only and always sends `credentials: "same-origin"`.
- The application resolves a session token afresh for every request; no anonymous or static-user fallback exists.
- Handrail resolves the session through Known Users and scopes submit, list, lookup, attachment, dismissal, cancellation, and release status to that principal.
- Server code overwrites raw delivery and automation fields. It forwards only the reporter's strict checkbox request object, and Handrail intersects those choices with the authenticated user's enhancement-specific matrix.
- Handrail bridge credentials remain server-only.
