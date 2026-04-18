# Agent Prompt 08 — T-24h Email Delivery

## Context

When the calendar listener (prompt 05) detects an external meeting 24 hours out, we send a brief via email. This is the primary delivery channel for users who don't install the extension.

## Task

Create `packages/email/` with Resend as the email provider.

### Features

- Render a Brief as a clean HTML email
- Send via Resend API
- Log delivery status to the API backend (`apps/api`)
- Handle bounces and unsubscribes

### HTML email rendering

Create a React Email template (`@react-email/components`):

```
packages/email/
├── src/
│   ├── index.ts
│   ├── send.ts
│   └── templates/
│       └── BriefEmail.tsx
├── package.json
└── tsconfig.json
```

### Design constraints

- Single column, max-width 600px
- Readable on mobile (most sales people check email on phone)
- Plain text fallback generated from markdown
- Every source citation is a proper hyperlink
- Unsubscribe link in footer (required by CAN-SPAM and DPDP)
- "View on DealBrief" link at top for the full experience
- No tracking pixels — we don't need open rates, we need quality

### Trigger API

```ts
export async function sendBriefEmail(opts: {
  to: string;
  brief: Brief;
  meetingTitle: string;
  meetingAt: string;
  unsubscribeToken: string;
}): Promise<{ id: string; status: "sent" | "queued" | "failed" }>;
```

### From address and deliverability

- `from: "DealBrief <briefs@dealbrief.io>"`
- Set `Reply-To` to the user's own email so replies don't go to the void
- SPF/DKIM/DMARC configured on the sending domain (document in README, not code)
- Sending cadence: at most 1 email per 24h per user per meeting

## Rules

- No tracking pixels
- Unsubscribe link must work in one click (no login required)
- Plain text fallback must be genuinely readable
- Never email a subject data (the prospect) — only the user (the seller)
- If the user sets preferences to no email, respect it

## Acceptance criteria

- `sendBriefEmail` successfully delivers to a test address
- Email renders correctly in Gmail, Outlook, Apple Mail on mobile + desktop
- Unsubscribe flow works without login
- Plain text fallback is usable

## Do NOT

- Use a shared sending domain (deliverability will be bad)
- Include the prospect as CC/BCC
- Include attachments — everything inline or linked
