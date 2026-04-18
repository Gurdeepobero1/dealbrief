# Coding Agent Prompts

These are ready-to-paste prompts for Cursor, Claude Code, Codex, or Aider. Each prompt is self-contained — it describes the goal, the context, the acceptance criteria, and the files to create or modify.

Use them in this order. Each module depends on the ones before.

| # | Prompt | What it builds | Est. tokens |
|---|---|---|---|
| 01 | `01-bootstrap.md` | Install deps, verify build | 2K |
| 02 | `02-more-sources.md` | Crunchbase + BuiltWith + MCA adapters | 6K |
| 03 | `03-caching.md` | Redis cache layer for enrichment | 5K |
| 04 | `04-api-backend.md` | Hono backend with calendar webhook + brief endpoint | 10K |
| 05 | `05-calendar-listener.md` | Google + Microsoft calendar OAuth and poll | 8K |
| 06 | `06-web-dashboard.md` | Next.js dashboard for brief history | 12K |
| 07 | `07-chrome-extension.md` | MV3 extension injecting into Google Calendar | 10K |
| 08 | `08-email-delivery.md` | T-24h email via Resend | 4K |
| 09 | `09-tests.md` | Unit + integration test suite | 8K |
| 10 | `10-deploy.md` | Cloudflare Workers deploy config | 5K |

## How to use these

**With Cursor:**
1. Open the repo
2. Cmd+L to open composer
3. Paste the prompt
4. Let the agent run — approve each file diff

**With Claude Code:**
```bash
claude "$(cat docs/agent-prompts/02-more-sources.md)"
```

**With Aider:**
```bash
aider --read docs/agent-prompts/02-more-sources.md
```

## Before running any agent prompt

1. `pnpm install && pnpm build` — make sure the existing code compiles
2. Commit your current state (`git add . && git commit -m "pre-agent"`)
3. Run one prompt at a time, verify, commit, next

Running multiple prompts in one go leads to merge conflicts and wasted work.
