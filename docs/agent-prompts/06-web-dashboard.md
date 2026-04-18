# Agent Prompt 06 — Web Dashboard (Next.js 15)

## Context

Users need a place to:
1. Connect Google/Microsoft calendar
2. Browse their history of generated briefs
3. Manage seller context (product description, ICP, value props)
4. See their team's admin controls (for paid tiers)
5. Access the erasure/privacy dashboard

## Task

Create `apps/web/` as a Next.js 15 App Router application.

### Pages

- `/` — marketing home (can be moved to a separate landing page later)
- `/dashboard` — recent briefs, upcoming meetings that will be briefed
- `/briefs/[id]` — renders a single Brief as HTML (using `renderBriefMarkdown` + a markdown renderer)
- `/settings` — seller context form, calendar connections, notification prefs
- `/me` — the public erasure page (no auth required) — enter email/LinkedIn URL to initiate deletion
- `/login` — Clerk-based auth

### Stack

- Next.js 15 App Router
- Tailwind CSS
- shadcn/ui components
- Clerk for auth
- `@tanstack/react-query` for API calls
- `marked` or `react-markdown` for Brief rendering

### Design direction

This is a B2B productivity tool for sellers. Aesthetic: **refined, editorial, serious**. Not flashy. Not purple gradients. Think Linear, Vercel, Stripe. Dense information, generous whitespace, neutral palette (warm greys + one accent color — suggest a deep teal `#0F766E` or desaturated amber `#B45309`). Serif for display, geometric sans for body. Avoid any AI-slop tropes.

### Key component: BriefView

The `/briefs/[id]` page is the product's centerpiece. It must:
- Show the brief in a reading-friendly layout
- Every source citation is a clickable pill with a hover preview of the source title + domain
- Openers are presented as cards with a copy-to-clipboard button
- Confidence scores render as small pills colored by threshold (green ≥0.8, amber 0.5-0.8, red <0.5)
- "Skip these" items render with a subtle warning background
- Sources list at the bottom is a properly styled reference list, not a wall of URLs

## Rules

- Server components by default; client components only when needed
- Every data fetch goes through the DealBrief API (prompt 04) — no direct calls to Groq/Proxycurl from the web app
- API keys never live in the browser
- The `/me` erasure page must work without auth and be findable from every page footer

## Acceptance criteria

- `pnpm --filter @dealbrief/web build` succeeds
- All pages render without console errors
- The BriefView is genuinely readable and good-looking, not a generic dashboard
- Dark mode supported
- Lighthouse accessibility score ≥ 95

## Do NOT

- Use default shadcn theme as-is — customize it meaningfully
- Use stock hero image clichés (abstract tech gradients, "AI brain" imagery)
- Overload with animations — this is a work tool, not a demo
