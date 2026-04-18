# Agent Prompt 05 — Calendar Listener (Google + Microsoft)

## Context

The habit loop that makes DealBrief sticky: 24 hours before every external meeting, a brief lands in the user's inbox. This requires reading their calendar.

## Task

Create `packages/calendar/` with OAuth-based calendar adapters for Google and Microsoft.

### Features

1. OAuth 2.0 flow for Google Calendar (read-only scope: `https://www.googleapis.com/auth/calendar.readonly`)
2. OAuth 2.0 flow for Microsoft Graph (scope: `Calendars.Read`)
3. Token refresh handling
4. Polling job: every 15 minutes, list events for next 48 hours
5. External-meeting detection: event has at least one attendee whose email domain ≠ user's domain
6. Deduplication: don't re-trigger briefs for the same eventId

### Structure

```
packages/calendar/
├── src/
│   ├── index.ts
│   ├── google.ts         # Google Calendar adapter
│   ├── microsoft.ts      # MS Graph adapter
│   ├── listener.ts       # Polling + deduplication
│   └── types.ts
├── package.json
└── tsconfig.json
```

### Shape

```ts
export interface CalendarProvider {
  name: "google" | "microsoft";
  listUpcomingEvents(opts: { fromISO: string; toISO: string }): Promise<CalendarEvent[]>;
  refreshToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: number }>;
}

export interface CalendarEvent {
  id: string;
  provider: "google" | "microsoft";
  scheduledAt: string;
  durationMin: number;
  organizer: string;
  attendees: Array<{ email: string; responseStatus?: string; self?: boolean }>;
  title: string;
  externalDomains: string[];   // derived — attendee domains ≠ organizer domain
}
```

### Polling

The `listener.ts` exports:
```ts
export async function runPollCycle(opts: {
  userId: string;
  provider: CalendarProvider;
  tokens: { accessToken: string; refreshToken: string };
  seenEventIds: Set<string>;
  onExternalEvent: (evt: CalendarEvent) => Promise<void>;
}): Promise<void>
```

This gets called by a Cloudflare Cron Trigger every 15 minutes.

## Rules

- Request the MINIMUM scope needed. Read-only. Never write.
- Store refresh tokens encrypted at rest (Cloudflare KV with encryption)
- Never log full attendee email addresses — redact to `first3***@domain.com`
- Handle 401 (token expired) by refreshing and retrying once, then disabling the integration and notifying the user
- Internal meetings (all attendees same domain as organizer) are NEVER briefed — skip them
- If an event has 10+ attendees, skip it — that's a large meeting, not a 1:1 sales call

## Acceptance criteria

- OAuth flow works end-to-end for both providers
- `runPollCycle` correctly identifies external meetings
- Deduplication prevents duplicate briefs when the same event is polled twice
- Token refresh works

## Do NOT

- Request write scopes
- Read calendar event attachments (they may contain confidential content)
- Surface internal meetings in any UI — strict filter
- Cache tokens unencrypted
