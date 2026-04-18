# DealBrief

> Stop Googling your prospects 5 minutes before the call.

DealBrief turns every calendar invite into a 24-hour-before meeting brief — who your prospect is, what their company is doing right now, and exactly how to open the call — grounded only in what they've chosen to make public, with a citation on every claim.

**Status:** 🚧 Pre-alpha. Building in public.

---

## What it does

1. You connect your Google or Outlook calendar (read-only)
2. 24 hours before any external meeting, DealBrief auto-generates a brief
3. The brief lands in your email, Slack, and inside the calendar event
4. Every claim is cited. Every inference is labeled. Every sensitive category is flagged.

## What it does NOT do

- ❌ Scrape personal social media (Instagram, personal X, Facebook)
- ❌ Phone number reverse lookup
- ❌ Breach-data enrichment
- ❌ Anything behind auth walls
- ❌ Personal life inference (relationships, health, politics, religion)

This is **public-footprint intelligence**, not surveillance. DPDP-compliant (India), GDPR-compliant (EU), CCPA-compliant (US).

## Architecture

Monorepo — `pnpm` + `turbo`:

```
dealbrief/
├── apps/
│   ├── cli/              # npx dealbrief <email>
│   ├── extension/        # Chrome MV3 extension (v2)
│   ├── web/              # Next.js dashboard (v2)
│   └── api/              # Hono backend (v2)
└── packages/
    ├── core/             # Orchestration + trigger scheduling
    ├── sources/          # Data source adapters (one file per source)
    ├── synthesis/        # LLM prompts + brief generation
    ├── trust/            # Citation, confidence, safe-to-mention engine
    └── shared/           # Zod schemas + types
```

## LLM stack (all free tier)

| Task | Model | Provider |
|---|---|---|
| Brief synthesis (the moat) | Llama 3.3 70B Versatile | Groq (free) |
| Source ranking + classification | Llama 3.1 8B Instant | Groq (free) |
| Safe-to-mention filtering | Gemma 2 9B | Groq (free) |
| Fallback / burst | Llama 3.3 70B | OpenRouter (free) |

**Free tier math:** 14,400 RPD × ~6 calls per brief = ~2,400 briefs/day before hitting limits. Plenty for early users.

## Data sources (v1)

All legal, all public-record:

- **Proxycurl** — LinkedIn public profile data (paid, licensed pipeline — NOT scraping)
- **Exa.ai** — semantic web search for news and signals
- **GitHub API** — public activity for technical roles
- **Listen Notes API** — podcast appearances
- **Crunchbase API** — funding and company data
- **BuiltWith** — public tech stack
- **MCA (India)** — company registration filings
- **Google News RSS** — news signals

## Quickstart

```bash
git clone https://github.com/<you>/dealbrief
cd dealbrief
pnpm install
cp .env.example .env
# Add your API keys (see .env.example)
pnpm dev
```

Try the CLI:

```bash
pnpm cli prep --email priya@zeta.in
```

## Roadmap

- **v1 (now)**: CLI + core brief generation + Trust Layer
- **v2 (Q3 2026)**: Chrome extension + calendar listener + web dashboard
- **v3 (Q4 2026)**: Power Map, warm intro path finder, CRM sync
- **v4 (2027)**: Live meeting copilot (with explicit consent flows)

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT — see [LICENSE](./LICENSE).

## Privacy stance

See [PRIVACY.md](./PRIVACY.md) for full data handling policy. TL;DR: we only touch data the subject made public themselves, we cite every claim, and we honor one-click deletion at `dealbrief.io/me`.
