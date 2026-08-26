# @handrail/enhancement-reporter

Authenticated, web-only customer enhancement requests for Handrail. The package provides a browser client, a ready-to-use React dialog, and a framework-neutral same-origin server handler with its own narrow Handrail REST transport. It does not require `@handrail/mcp`.

Current releases apply the enhancement-specific Default, User, or Full Access matrix. Pending stays non-executing, Ask renders customer checkboxes, and Always applies automatically. Staging and production remain bounded by that matrix and Handrail's normal deployment gates. Every request stays scoped to the authenticated Known User who submitted it.

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

The enhancement reporter stands on its own; neither the generic Assistant Change Bridge product surface nor `@handrail/mcp` is an application integration dependency. The browser entry never accepts or transmits a Handrail transport credential. Mount the server handler on the same origin, behind your normal application authentication boundary, and keep the transport credential in server-only environment variables.

Handrail's **Enhancement Automation** setup provisions this transport automatically. Generic assistant actions and their user assignments may remain disabled. New integrations should use the enhancement-specific runtime names below; Handrail also emits the legacy `HANDRAIL_ASSISTANT_BRIDGE_*` names so existing applications continue to work.

## Server route

The example below fits a Next.js catch-all route at `app/api/handrail-enhancements/[[...path]]/route.ts`. The same handler works with any framework that supplies Web `Request` and `Response` objects.

```ts
import { createSameOriginEnhancementReporterHandler } from "@handrail/enhancement-reporter/server";

const handler = createSameOriginEnhancementReporterHandler({
  routeBasePath: "/api/handrail-enhancements",
  apiUrl: process.env.HANDRAIL_ENHANCEMENT_REPORTER_API_URL!,
  projectId: process.env.HANDRAIL_ENHANCEMENT_REPORTER_PROJECT_ID!,
  capabilityId: process.env.HANDRAIL_ENHANCEMENT_REPORTER_CAPABILITY_ID!,
  token: process.env.HANDRAIL_ENHANCEMENT_REPORTER_TOKEN!,
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

## Choose an integration path

The SDK has two independent adoption paths:

- **Packaged React UI:** mount `EnhancementReporterButton` or control
  `EnhancementReporterDialog` yourself for a complete submission and owned
  history experience.
- **Custom/headless UI:** call the browser client directly, or use the React
  provider and `useEnhancementReporter()` hook with your own components.

The packaged UI is strictly opt-in. Importing this package, mounting only the
provider, or upgrading an existing integration never inserts a launcher or
opens a dialog. Bugs remain a separate SDK, API, and presentation surface.

## Packaged React UI

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
      <EnhancementReporterButton
        label="Suggest an enhancement"
        appearance={{ themeMode: "auto" }}
      />
    </EnhancementReporterProvider>
  );
}
```

`EnhancementReporterButton` is the launcher; `EnhancementReporterDialog` is
also exported separately for an app-owned launcher or menu. Both delegate
discovery, submission, subscriptions, and history mutations to the same client
provided by `EnhancementReporterProvider` (or to an explicit `client` prop).

### Appearance and accessibility

`appearance.themeMode` accepts `"auto"` (the default), `"light"`, or `"dark"`.
Auto mode inherits the host's color scheme and typography. Override individual
tokens without replacing the UI:

```tsx
<EnhancementReporterButton
  appearance={{
    themeMode: "dark",
    tokens: {
      accent: "#7c3aed",
      accentText: "#ffffff",
      radius: "8px",
      fontFamily: "var(--app-font)",
    },
    style: { zIndex: 1000 },
  }}
/>
```

Available tokens are `accent`, `accentText`, `surface`, `surfaceMuted`, `text`,
`mutedText`, `border`, `overlay`, `dangerSurface`, `dangerText`,
`successSurface`, `successText`, `radius`, and `fontFamily`. They map to scoped
`--handrail-enhancement-*` CSS custom properties. `appearance.className`
targets the dialog and `appearance.style` targets the overlay, so an
application can add narrowly scoped CSS overrides. Launcher `className` and
`style` props remain separate.

The dialog is viewport-bounded and scrolls internally on smaller screens. It
has labeled dialog and tab semantics, traps keyboard focus while open, supports
arrow/Home/End tab navigation, closes with Escape or an overlay click, and
restores focus to the prior control. Loading, validation, failure, and success
states are exposed as text and live-region announcements; status meaning does
not depend on color alone.

The dialog supports file upload and direct image paste from the clipboard. Accepted formats are PNG, JPEG, GIF, and WebP, with a maximum of 4 images, 5 MiB per image, and 15 MiB total. Both the browser and Handrail validate image signatures and limits.

The packaged dialog shows its unchecked **Email me when this is fixed** control
only when policy discovery confirms that the current session
is a verified Known User with a valid configured Display/email value. It shows
only a masked recipient hint and never asks for or sends a manual address. The
browser submits the enhancement first and then sends report-scoped consent to
the same-origin `/requests/:requestId/subscription` route; Handrail verifies the
session again and derives the recipient from Known Users. A subscription
failure is returned as a separate warning. Handrail sends one email after
release evidence confirms the fix is available in the environment where the
request originated; internal Fixed and Deployed transitions do not each send
mail. The email includes an unsubscribe link. Set `notificationsEnabled: false` to hide the control. The
legacy `reporterEmail` option is ignored and deprecated for source
compatibility.

When an action is configured as **Ask**, the dialog renders its checkbox. A staging or production checkbox is enabled only when the Work Request will start. **Always** actions do not require a customer checkbox; **Pending** Work Request policy keeps delivery unavailable.

Every verified Known User may submit while the runtime enhancement switch is enabled. The dialog calls the same-origin policy route before rendering navigation, and every verified user receives the **My requests** tab automatically. The tab lists only requests owned by the current authenticated principal, and returned attachment URLs pass through the same principal-scoped route. Enhancement Automation Default/User/Full Access tiers control automation policy only; applications do not need to assign each new user merely to enable owned history.

**My requests** initially loads the 10 newest active requests and offers **Show
more** for older bounded pages. When discovery advertises them, the packaged UI
also exposes search, status, sort, and Active/Dismissed/All visibility filters,
individual **Dismiss** and **Restore** actions, and **Clear succeeded**. Each row
summarizes the strongest release evidence available, preferring production and
then staging, and includes the deployed application version when Handrail has
recorded one. Missing release tracking or environment targets display
**Deployment status unavailable** rather than **Not deployed**. Dismissal only
changes that principal's history presentation; it never deletes, cancels, or
changes the linked Work Request. Set `historyPageSize` on
`EnhancementReporterDialog` to use another page size from 1 through 50.

The SDK does not impose a history screen on app-owned integrations. `list` returns exact summary counts for a tab badge and status filters, plus the server-normalized query. Apps can style Active and Dismissed views independently, restore individual requests, or clear all succeeded requests while preserving every canonical Work Request.

## Custom/headless browser API

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
  // Optional and report-scoped. Handrail derives the recipient from the
  // authenticated, verified Known User; never collect or send an address.
  notification: { notifyOnResolution: true },
});

const badgePage = await reporter.list({ limit: 1, visibility: "active" });
const myRequestsBadge = badgePage.summary?.total ?? badgePage.pagination.total;

const mine = await reporter.list({
  limit: 10,
  search: "calendar",
  statusGroup: "succeeded",
  sort: "newest",
  visibility: "active",
});
const current = await reporter.lookup(mine.requests[0].id);
const release = await reporter.releaseStatus(current.id);
await reporter.dismiss(current.id);
await reporter.restore(current.id);
await reporter.dismissSucceeded();
```

For a custom React presentation, mount the provider and consume the same client
without mounting either packaged UI component:

```tsx
import { useEnhancementReporter } from "@handrail/enhancement-reporter/react";

function SuggestionForm() {
  const reporter = useEnhancementReporter();
  // Build app-specific fields and consent UI, then call reporter.submit(...).
  return <YourSuggestionForm reporter={reporter} />;
}
```

`list({ limit, offset, search, statusGroup, sort, visibility })` returns bounded pagination metadata, exact counts for `needs_attention`, `in_progress`, `succeeded`, and `closed`, and the normalized query. `visibility` accepts `active`, `dismissed`, or `all`. `releaseStatus` reports the eventual full commit SHA/version and its deployment state once staff approve and deliver the linked Work Request. `dismiss`, `restore`, and `dismissSucceeded` change only the current principal's history presentation while preserving the canonical request and linked Work Request.

## Security contract

- Browser transport is same-origin only and always sends `credentials: "same-origin"`.
- The application resolves a session token afresh for every request; no anonymous or static-user fallback exists.
- Handrail resolves the session through Known Users and scopes submit, list, lookup, attachment, dismissal, restoration, bulk history clearing, cancellation, and release status to that principal.
- Server code overwrites raw delivery and automation fields. It forwards only the reporter's strict checkbox request object, and Handrail intersects those choices with the authenticated user's enhancement-specific matrix.
- Handrail enhancement transport credentials remain server-only.
