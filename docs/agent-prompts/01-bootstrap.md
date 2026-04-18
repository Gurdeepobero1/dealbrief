# Agent Prompt 01 — Bootstrap

Paste this prompt into your coding agent. Goal: verify the repo builds end-to-end.

---

## Context

This is a TypeScript monorepo using pnpm workspaces + Turbo. Structure:

```
apps/cli
packages/{shared, sources, synthesis, trust, core}
```

Every package uses `"type": "module"` (ESM). TypeScript is strict with `noUncheckedIndexedAccess`.

## Task

1. Run `pnpm install` at the repo root.
2. Run `pnpm build` and fix any TypeScript errors that appear.
3. Run `pnpm typecheck` and fix any type errors.
4. Do NOT change any prompt files in `packages/synthesis/prompts/` — these are the product moat.
5. If the build still fails after fixing trivial type errors, report what's blocking — do not add `any` types or `@ts-ignore` as a workaround.

## Acceptance criteria

- `pnpm build` exits 0
- `pnpm typecheck` exits 0
- `node apps/cli/dist/index.js doctor` prints the environment check
- No new dependencies added without updating the relevant `package.json` intentionally

## Definitely do NOT

- Modify schemas in `packages/shared/src/schemas.ts` (the contract)
- Modify prompts in `packages/synthesis/prompts/` (the moat)
- Add `any` types
- Remove strict TS options

Report back when the build is green.
