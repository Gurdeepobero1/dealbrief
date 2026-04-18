# Agent Prompt 10 — Deployment

## Context

We've built the monorepo. Now it needs to run in production.

## Task

Set up deployment infrastructure.

### Targets

1. **`apps/api`** → Cloudflare Workers (from prompt 04)
2. **`apps/web`** → Vercel (Next.js)
3. **`apps/extension`** → Chrome Web Store (manual submission)
4. **`apps/cli`** → npm registry (`npm publish --access public`)

### Config files

**`apps/api/wrangler.toml`** — already exists from prompt 04. Add:
- Production environment with KV namespace IDs
- Cron triggers: `*/15 * * * *` for the calendar poll
- Secrets bound: `GROQ_API_KEY`, `PROXYCURL_API_KEY`, `EXA_API_KEY`, `CLERK_SECRET_KEY`

**`apps/web/vercel.json`**:
- Root: `apps/web`
- Build: `cd ../.. && pnpm build --filter=@dealbrief/web`
- Output: `apps/web/.next`
- Environment variables: `NEXT_PUBLIC_API_URL`, Clerk publishable/secret keys

**`.github/workflows/deploy.yml`**:
- On push to `main`: deploy API to Cloudflare, Vercel handles web automatically
- On tag `cli-v*`: publish `@dealbrief/cli` to npm
- Secrets needed: `CLOUDFLARE_API_TOKEN`, `NPM_TOKEN`

### Domain

- `dealbrief.io` → marketing
- `app.dealbrief.io` → web dashboard (Vercel)
- `api.dealbrief.io` → API backend (Cloudflare)
- `me.dealbrief.io` → redirects to `app.dealbrief.io/me` (erasure flow)

### Secrets management

Never check secrets into git. Use:
- Cloudflare: `wrangler secret put`
- Vercel: dashboard environment variables
- GitHub Actions: repository secrets

Create `docs/DEPLOYMENT.md` documenting the full setup so a new team member can deploy from scratch.

### Monitoring

- Sentry for error tracking (web + API)
- Axiom for structured logs from Workers
- Betterstack for uptime monitoring of `api.dealbrief.io/v1/health`
- Cost alert on Groq spend (shouldn't hit it on free tier, but monitor)

### Rate limiting at the edge

- Cloudflare rate limiting rules: 100 req/min per IP on `/v1/briefs`, 1000/min across all endpoints
- Anonymous requests (missing auth) rate-limited to 10 req/hour per IP

## Acceptance criteria

- Pushing to `main` deploys the API to Cloudflare
- Pushing to `main` deploys the web app to Vercel
- Publishing a `cli-v*` tag publishes to npm
- `docs/DEPLOYMENT.md` is complete enough for onboarding
- Uptime monitoring alerts go somewhere a human reads

## Do NOT

- Enable Cloudflare email tracking on the API domain (we don't send email from there)
- Set up any analytics that tracks prospects (subjects of briefs)
- Skip the CORS config — it's the main thing between production and an open API
