# Agent Prompt 02 — Additional Source Adapters

## Context

DealBrief has 4 source adapters in `packages/sources/src/`:
- `proxycurl.ts` — LinkedIn public profiles
- `exa.ts` — semantic web search
- `github.ts` — public GitHub activity
- `listenNotes.ts` — podcast appearances

All adapters implement the `SourceAdapter<TQuery, TResult>` interface from `./types.ts`. Every adapter has a `licenseNote` documenting the legal basis for its use.

## Task

Implement three new adapters following the same pattern.

### 1. `crunchbase.ts` — company funding and team data

- API: Crunchbase Enterprise API v4 (https://data.crunchbase.com/docs/using-the-api)
- Env var: `CRUNCHBASE_API_KEY`
- Query input: `{ companyDomain?: string; companyName?: string }`
- Output shape: `{ name, description, foundedOn?, employeeCountRange?, fundingTotalUsd?, lastFundingRound?: { stage, announcedAt, amountUsd, leadInvestor }, categories: string[], sourceUrl, sourceIds: string[] }`
- licenseNote: `"Crunchbase Enterprise API. Licensed data on companies, founders, funding."`
- Handle 429 with `RateLimitError(60_000)`

### 2. `builtwith.ts` — public tech stack

- API: BuiltWith Domain API (https://api.builtwith.com)
- Env var: `BUILTWITH_API_KEY`
- Query input: `{ domain: string }`
- Output shape: `{ domain, technologies: Array<{ name, category, firstDetected?: string, lastDetected?: string }>, sourceUrl, sourceIds: string[] }`
- licenseNote: `"BuiltWith API. Public web technology detection via DNS/HTTP fingerprinting."`
- If `BUILTWITH_API_KEY` is missing, return empty array (optional source)

### 3. `mca.ts` — Ministry of Corporate Affairs India (CIN/entity lookup)

- Source: MCA is public. Use the public MCA21 portal search where available. If no official API, use the Open Government Data Platform (data.gov.in) which republishes MCA filings.
- NO scraping. Query data.gov.in's resource API: https://api.data.gov.in/resource/{resource_id}
- Env var: `DATA_GOV_IN_API_KEY` (free, register at data.gov.in)
- Query input: `{ companyName?: string; cin?: string }`
- Output shape: `{ cin?, companyName, registeredAddress?, incorporationDate?, authorizedCapital?, paidUpCapital?, directors?: string[], sourceUrl, sourceIds: string[] }`
- licenseNote: `"Ministry of Corporate Affairs data via Open Government Data Platform (data.gov.in). Public statutory filings."`
- This is a best-effort source — return null if resource ID lookup fails

## Rules

- Every adapter must include a `licenseNote` — required.
- Every adapter must implement `fetch()` returning a normalized shape (snake_case → camelCase).
- Every adapter must handle 429 by throwing `RateLimitError(retryAfterMs)`.
- Every adapter must return `null` or an empty result (not throw) for 404s.
- Every adapter must use `sourceId(url)` from `./types.ts` to generate stable source IDs.
- Export from `packages/sources/src/index.ts`.
- Add corresponding env vars to `.env.example` at the repo root.

## Acceptance criteria

- `pnpm typecheck` passes for `@dealbrief/sources`
- Each adapter has a `licenseNote`
- No scraping — only documented APIs
- `.env.example` updated

## Do NOT

- Add LinkedIn scrapers (we use Proxycurl)
- Add Apollo, ZoomInfo, Clearbit, Lusha APIs without asking — these have complex redistribution terms
- Add adapters for Instagram, Facebook, personal Twitter/X
- Read cached data from paid breach databases even if a free endpoint exists
