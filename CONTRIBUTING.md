# Contributing to DealBrief

Thanks for wanting to contribute. A few things to know before you start.

## The non-negotiables

DealBrief is **public-footprint intelligence, not surveillance**. Pull requests that add any of the following will be closed immediately:

- Scrapers for platforms that prohibit scraping in their ToS
- Personal social media adapters (Instagram, personal X, Facebook)
- Phone number reverse lookup
- Breach data sources
- Any source that accesses content behind auth walls
- Inference of sensitive categories (politics, religion, health, relationships, etc.)

Every new data source must include a `licenseNote` explaining the legal basis for its use. No exceptions.

## Getting started

```bash
git clone https://github.com/<owner>/dealbrief
cd dealbrief
pnpm install
cp .env.example .env    # fill in keys
pnpm build
pnpm cli -- prep --linkedin https://linkedin.com/in/<someone-who-consented>
```

## Project structure

- `packages/shared` — Zod schemas. The source of truth for data shapes.
- `packages/sources` — Data adapters. One file per source.
- `packages/synthesis` — LLM pipeline + prompts. This is where the moat lives.
- `packages/trust` — Citation validation and rendering.
- `packages/core` — End-to-end orchestration.
- `apps/cli` — The `dealbrief` command.

## Adding a new source adapter

1. Create `packages/sources/src/<name>.ts`
2. Implement the `SourceAdapter` interface from `./types.ts`
3. Include a `licenseNote` explaining why this source is legal to use
4. Add a test case with a mock HTTP response
5. Export it from `packages/sources/src/index.ts`
6. Open a PR — maintainers will review the license basis

## Iterating on prompts

Prompts live in `packages/synthesis/prompts/`. They are the most important files in the repo.

**Rules:**
- Update `VERSION.md` with every change
- Include a before/after example of output in the PR
- Do not merge prompt changes without running against at least 10 real profiles
- Regressions on opener quality are blockers

## Testing

```bash
pnpm test             # unit tests
pnpm typecheck        # type safety across all packages
pnpm lint             # style
```

## Code style

- TypeScript everywhere, strict mode
- No `any` without a comment explaining why
- Zod for every data boundary (HTTP responses, LLM outputs, env vars)
- No `console.log` in library code — use the logger
- No dependencies added without discussion

## Reporting bugs

Open an issue with:
- What you expected
- What actually happened
- Minimum reproduction (LinkedIn URL of a public profile, command run, output)

## Privacy-related reports

Email `privacy@dealbrief.io` directly — do not open a public issue for:
- Deletion requests
- Data handling concerns
- Suspected non-compliant source adapter in the wild

## License

By contributing, you agree your contributions are licensed under MIT.
