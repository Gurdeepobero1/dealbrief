# Agent Prompt 04 — API Backend (Hono + Cloudflare Workers)

## Context

We need a hosted backend for:
1. The Chrome extension to POST calendar events to
2. The web dashboard to fetch brief history
3. Scheduled triggers (T-24h, T-30min) for calendar events

## Task

Create `apps/api/` as a Hono app deployable to Cloudflare Workers.

### Endpoints (v1)

- `POST /v1/briefs` — body: `{ linkedinUrl | email, companyDomain?, sellerContext? }` → returns generated Brief. Auth: Bearer API key from `DEALBRIEF_API_KEY` header.
- `GET /v1/briefs/:id` — retrieves a previously generated brief by ID. Auth: same.
- `POST /v1/calendar/events` — body: `{ eventId, scheduledAt, attendees: string[], organizerEmail }` → enqueues a T-24h brief generation. Auth: same.
- `GET /v1/health` — returns `{ status: "ok", version }`. No auth.
- `POST /v1/erasure` — body: `{ email | linkedinUrl, verificationToken }` → deletes all cached data for subject. This is the DPDP/GDPR deletion endpoint.

### Storage

- Cloudflare KV for brief storage (key = brief ID, value = JSON)
- Cloudflare Queues for scheduled brief generation
- Redis/Upstash for enrichment cache (use the `cached` wrapper from prompt 03)

### Structure

```
apps/api/
├── src/
│   ├── index.ts          # Hono app + routes
│   ├── routes/
│   │   ├── briefs.ts
│   │   ├── calendar.ts
│   │   ├── erasure.ts
│   │   └── health.ts
│   ├── middleware/
│   │   ├── auth.ts       # Bearer token
│   │   └── ratelimit.ts
│   └── queue.ts          # Scheduled job handler
├── wrangler.toml
├── package.json
└── tsconfig.json
```

### wrangler.toml

Include KV namespace bindings, queue bindings, and environment variable declarations. Use `nodejs_compat` flag.

## Rules

- All inputs validated with Zod
- Every endpoint returns typed responses
- Rate limiting: 100 req/hour per API key (Cloudflare's built-in)
- Auth errors return 401 with JSON body, never leak internals
- The erasure endpoint requires a verification token sent to the subject's email first — implement the two-step flow
- CORS: allow only the web dashboard origin + extension origin, configurable via env

## Acceptance criteria

- `pnpm --filter @dealbrief/api build` succeeds
- `wrangler dev` runs locally and `/v1/health` responds
- Auth middleware rejects missing/invalid bearer tokens with 401
- `POST /v1/briefs` with a real LinkedIn URL (and keys set) returns a Brief
- Erasure endpoint is two-step and logged for audit

## Do NOT

- Put `GROQ_API_KEY` or `PROXYCURL_API_KEY` in wrangler.toml as plain vars — use `wrangler secret put`
- Expose any endpoint that lets a caller fetch arbitrary URLs (SSRF risk)
- Log full LinkedIn URLs or emails in request logs — redact to domain level
