# Agent Prompt 07 — Chrome Extension (MV3)

## Context

The extension is the habit loop: when a user is in Google Calendar or Gmail, DealBrief shows up inline for every external meeting.

## Task

Build `apps/extension/` as a Manifest V3 Chrome extension.

### Features (v1)

1. **Content script on calendar.google.com**: for each external event, inject a DealBrief badge. On click, open a side panel with the brief.
2. **Content script on mail.google.com**: on an email thread with a meeting-related subject or an .ics attachment, show a DealBrief button.
3. **Background service worker**: handles API calls to DealBrief API, token storage via `chrome.storage.local`.
4. **Side panel** (using MV3 sidePanel API): renders a brief inline without leaving the tab.
5. **Login flow**: opens a popup to `dashboard.dealbrief.io/extension-auth` which returns a token.

### Structure

```
apps/extension/
├── src/
│   ├── background.ts         # service worker
│   ├── content/
│   │   ├── calendar.ts       # google calendar injection
│   │   └── gmail.ts          # gmail injection
│   ├── sidepanel/
│   │   ├── index.html
│   │   ├── index.tsx
│   │   └── BriefView.tsx
│   └── shared/
│       ├── api.ts            # DealBrief API client
│       └── storage.ts        # chrome.storage wrapper
├── manifest.json
├── vite.config.ts
├── package.json
└── tsconfig.json
```

### Manifest

```json
{
  "manifest_version": 3,
  "name": "DealBrief",
  "version": "0.1.0",
  "permissions": ["storage", "sidePanel"],
  "host_permissions": [
    "https://calendar.google.com/*",
    "https://mail.google.com/*",
    "https://api.dealbrief.io/*"
  ],
  "background": { "service_worker": "dist/background.js" },
  "content_scripts": [
    { "matches": ["https://calendar.google.com/*"], "js": ["dist/content/calendar.js"] },
    { "matches": ["https://mail.google.com/*"], "js": ["dist/content/gmail.js"] }
  ],
  "side_panel": { "default_path": "dist/sidepanel/index.html" },
  "action": { "default_title": "DealBrief" }
}
```

### Build

Use Vite with `@crxjs/vite-plugin` for MV3 support. Output to `dist/`.

## Rules

- Minimal permissions: only `storage` and `sidePanel`, and host permissions for the domains we need
- Never request `tabs` or `<all_urls>`
- Content scripts must not read email bodies beyond subject lines + ics attachments (for Gmail trigger)
- API calls happen only from the service worker (not content scripts — cross-origin rules)
- No third-party trackers (no Google Analytics, no Sentry without a privacy notice)
- User data never leaves the extension without an authenticated API call

## Acceptance criteria

- `pnpm --filter @dealbrief/extension build` produces a working `dist/` that loads as an unpacked extension
- Opening Google Calendar shows a DealBrief badge on external events
- Clicking the badge opens the side panel with a brief (or a "Generating..." state → brief)
- Login flow works and persists across browser restarts

## Do NOT

- Inject styles that break Google Calendar's UI — use Shadow DOM for the badge
- Read DOM content beyond what's needed to identify external meetings
- Log user calendar content anywhere
