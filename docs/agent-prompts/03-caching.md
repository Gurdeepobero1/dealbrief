# Agent Prompt 03 — Enrichment Cache Layer

## Context

`prepBrief` in `packages/core/src/index.ts` makes ~4 external API calls (Proxycurl, Exa, GitHub, Listen Notes). Each LinkedIn lookup via Proxycurl costs ~$0.05. Caching is critical for unit economics.

## Task

Add a Redis-backed cache layer with these properties:

1. Cache key: SHA-256 of the canonical query (e.g., LinkedIn URL normalized)
2. TTL: 7 days default (from `CACHE_TTL_SECONDS` env var)
3. Graceful fallback: if Redis is unavailable, log a warning and proceed without cache
4. Cache HIT should be logged with source name and key prefix (not full key)
5. Used by all source adapters transparently — callers shouldn't change

### Implementation plan

Create `packages/core/src/cache.ts`:

```ts
export interface Cache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
}
```

Provide two implementations:
- `InMemoryCache` — Map-based, default for dev/no-Redis
- `RedisCache` — uses `ioredis`, activated when `REDIS_URL` is set

Create `packages/core/src/cached.ts` with a higher-order wrapper:

```ts
export function cached<Q, R>(
  adapter: SourceAdapter<Q, R>,
  cache: Cache,
  ttlSeconds?: number
): SourceAdapter<Q, R>
```

Update `prepBrief` to wrap each adapter with `cached(...)`.

## Rules

- Use `ioredis` (not `redis` or `node-redis`) — it's the most battle-tested
- Canonical key generation: for LinkedIn URLs, strip trailing slashes and query params. For emails, lowercase.
- Never cache errors — only successful responses
- Never cache `null` returns from adapters — next call should retry
- Cache hits should not count against rate limits (we don't need to refetch)

## Acceptance criteria

- `pnpm typecheck` green
- With `REDIS_URL` unset, `prepBrief` works identically to before (in-memory cache)
- With `REDIS_URL` set, running `prepBrief` twice on the same LinkedIn URL only hits Proxycurl once
- Cache failures (Redis down) don't crash `prepBrief`
