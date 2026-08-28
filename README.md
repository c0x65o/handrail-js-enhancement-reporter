# @handrail/enhancement-reporter

Authenticated, web-only customer enhancement requests for Handrail. The package provides a browser client, a ready-to-use React dialog, and a framework-neutral same-origin server handler with its own narrow Handrail REST transport. It does not require `@handrail/mcp`.

Every submission creates a first-class Project Management Enhancement and starts a read-only AI assessment when that runtime option is enabled. Assessment can gather repository evidence, propose acceptance criteria and QA, and assess source-change risk, but it cannot edit source, commit, implement, or deploy. Handrail staff explicitly accept a proposal and authorize implementation later. Every request stays scoped to the authenticated Known User who submitted it.

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

The enhancement reporter has a dedicated first-class Enhancement Reporting API and capability; `@handrail/mcp` is not an application integration dependency. The browser entry never accepts or transmits a Handrail transport credential. Mount the server handler on the same origin, behind your normal application authentication boundary, and keep the transport credential in server-only environment variables.

Handrail provisions the `enhancement_reporting` capability against one exact server runtime and injects only the enhancement-specific variables below. It is independent from assistant features and credentials.

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
The compact, wide desktop dialog mirrors Handrail's packaged bug reporter. The
request form and history share one bounded height so the shell stays stable as
users switch tabs, while the priority selector sits beside an **Attached context** panel,
with notifications grouped into the same side
rail. The context panel shows the current route, page title, application
version, and viewport values that the client will submit; no build field is
shown in the packaged form.

### Appearance and accessibility

`appearance.themeMode` accepts `"auto"` (the default), `"light"`, or `"dark"`.
Auto mode inherits the host's CSS `color-scheme` and typography. Use it when
the host publishes its active scheme through CSS. If the application stores an
account-level theme that can differ from the operating-system preference, pass
the current `"light"` or `"dark"` value and the corresponding product tokens.
Changing `themeMode` or `tokens` on a later render immediately restyles the
built-in launcher and open dialog; the provider and headless client do not need
to be remounted. Override individual tokens without replacing the UI:

```tsx
<EnhancementReporterButton
  appearance={{
    themeMode: "dark",
    tokens: {
      accent: "#7c3aed",
      accentText: "#ffffff",
      infoText: "#60a5fa",
      radius: "8px",
      fontFamily: "var(--app-font)",
    },
    style: {
      zIndex: 1000,
      "--handrail-enhancement-warning-text": "var(--app-warning)",
    },
  }}
/>
```

Available tokens are `accent`, `accentText`, `surface`, `surfaceMuted`, `text`,
`mutedText`, `border`, `overlay`, `dangerSurface`, `dangerText`,
`successSurface`, `successText`, `warningSurface`, `warningText`, `infoSurface`,
`infoText`, `radius`, and `fontFamily`. They map to scoped
`--handrail-enhancement-*` CSS custom properties. `appearance.className`
targets the dialog and `appearance.style` targets the overlay, so an
application can add narrowly scoped, type-safe CSS-variable overrides. Direct
variables in `appearance.style` take precedence over `appearance.tokens`.
The built-in launcher installs the configured tokens on itself, so its default
primary treatment matches the dialog. Launcher `className` and `style` props
remain separate and still replace that default treatment when supplied.

The dialog is viewport-bounded at 1560 × 960 px and scrolls internally on
smaller screens. It
has labeled dialog and tab semantics, traps keyboard focus while open, supports
arrow/Home/End tab navigation, closes with Escape or an overlay click, and
restores focus to the prior control. Loading, validation, failure, and success
states are exposed as text and live-region announcements; status meaning does
not depend on color alone.

The dialog supports file upload, direct image paste from the clipboard, and drag and drop onto the screenshot area. Accepted formats are PNG, JPEG, GIF, and WebP, with a maximum of 4 images, 5 MiB per image, and 15 MiB total. Both the browser and Handrail validate image signatures and limits.

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

The dialog never asks the customer to authorize work or choose a deployment target. Submission authority is intake-only. Handrail evaluates the accepted assessment against the current project policy when staff later choose **Approve and implement**.

Every verified Known User may submit while the runtime enhancement switch is enabled. The dialog calls the same-origin discovery route before rendering navigation, and every verified user receives the **My requests** tab automatically. The tab lists only requests owned by the current authenticated principal, and returned attachment URLs pass through the same principal-scoped route. Known User roles affect later Handrail authorization decisions; they never turn SDK submission into implementation authority.

**My requests** initially loads the 10 newest active requests and offers **Show
more** for older bounded pages. When discovery advertises them, the packaged UI
also exposes search, status, sort, and Active/Archived/All visibility filters,
plus individual **Archive** and **Restore** actions. It deliberately provides
no bulk clear action. Archive and restore update the visible status counts
immediately and then refresh the current server-backed page. The
tracker scrolls within the stable dialog and changes its dense desktop table to
compact cards before the six-column layout can overflow; each row can expand to
show the request description and attachment names. Each row
summarizes the strongest release evidence available, preferring production and
then staging, and includes the deployed application version when Handrail has
recorded one. Missing release tracking or environment targets display
**Deployment status unavailable** rather than **Not deployed**. Archiving only
changes that principal's history presentation; it never deletes, cancels, or
changes the first-class enhancement or any later linked implementation Work Request. Set `historyPageSize` on
`EnhancementReporterDialog` to use another page size from 1 through 50.

The SDK does not impose a history screen on app-owned integrations. `list` returns exact summary counts for a tab badge and status filters, plus the server-normalized query. Apps can style Active and Archived views independently and restore individual requests while preserving every canonical enhancement. The wire-level visibility value remains `dismissed` for compatibility.

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

`list({ limit, offset, search, statusGroup, sort, visibility })` returns bounded pagination metadata, exact counts for `needs_attention`, `in_progress`, `succeeded`, and `closed`, and the normalized query. `visibility` accepts `active`, `dismissed`, or `all`. `releaseStatus` reports the eventual full commit SHA/version and its deployment state after staff approve the proposal and deliver the later linked implementation Work Request. `dismiss`, `restore`, and `dismissSucceeded` change only the current principal's history presentation while preserving the first-class enhancement and any later implementation link.

## Security contract

- Browser transport is same-origin only and always sends `credentials: "same-origin"`.
- The application resolves a session token afresh for every request; no anonymous or static-user fallback exists.
- Handrail resolves the session through Known Users and scopes submit, list, lookup, attachment, dismissal, restoration, bulk history clearing, cancellation, and release status to that principal.
- Server code allowlists intake fields and drops browser-supplied implementation, Codex, commit, CI, and deployment authority.
- Handrail enhancement transport credentials remain server-only.
