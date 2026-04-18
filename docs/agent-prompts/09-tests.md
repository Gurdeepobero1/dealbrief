# Agent Prompt 09 — Test Suite

## Context

DealBrief makes expensive API calls ($0.05/brief). Tests must not hit real APIs — mock everything.

## Task

Add comprehensive tests using Vitest.

### Unit tests

For every package:
- `packages/shared` — Zod schemas parse/reject the right inputs
- `packages/sources` — each adapter mocked with `msw` (Mock Service Worker)
- `packages/synthesis` — LLM calls mocked, prompt outputs verified against `BriefSchema`
- `packages/trust` — `validateBrief` passes/fails correctly; `renderBriefMarkdown` matches snapshot
- `packages/core` — end-to-end `prepBrief` with all sources mocked

### Integration tests (optional, gated on `INTEGRATION_TESTS=1`)

- Real Groq API call with a fixed deterministic prompt — verify JSON parses
- Real Proxycurl call with a known public profile (maintainer's own) — verify normalization

### Golden tests for the synthesis prompt

This is the most important test suite. Create `packages/synthesis/test/golden/`:

- 10 hand-crafted input JSONs (Person + Company + Sources)
- For each, run the synthesis prompt and assert:
  - Output parses as `BriefSchema`
  - All 3 openers have `confidence >= 0.4`
  - Every opener has at least one `groundedInSourceIds` that exists in input
  - No claim references a sensitive category from a blocklist of strings
  - Opener text does not contain "Congrats on" without additional specific content
  - `skipThese` is populated if the input contained flagged items

### CI

`.github/workflows/test.yml`:

```yaml
name: test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: pnpm typecheck
      - run: pnpm test
```

## Rules

- Never hit real APIs in unit tests
- Integration tests gated behind env var, skipped in CI default
- Every PR must maintain or increase coverage
- Golden tests for the synthesis prompt are the quality gate — do not disable when they fail

## Acceptance criteria

- `pnpm test` runs in <30 seconds
- Coverage ≥ 70% on all non-app packages
- Golden tests pass on a fresh checkout
- CI passes on GitHub Actions

## Do NOT

- Commit real API keys to test fixtures
- Use `it.skip` to disable failing tests — fix them or remove them
