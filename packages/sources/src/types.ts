import type { Source } from "@dealbrief/shared";

/**
 * Every source adapter implements this interface.
 * Adapters are licensed/public-data ONLY. No scraping adapters are permitted.
 */
export interface SourceAdapter<TQuery, TResult> {
  name: string;
  sourceType: Source["sourceType"];
  licenseNote: string;               // Documents the legal basis for this source
  fetch(query: TQuery): Promise<TResult>;
}

export class RateLimitError extends Error {
  constructor(public readonly retryAfterMs: number) {
    super(`Rate limited, retry in ${retryAfterMs}ms`);
    this.name = "RateLimitError";
  }
}

export class SourceUnavailableError extends Error {
  constructor(source: string, reason: string) {
    super(`Source ${source} unavailable: ${reason}`);
    this.name = "SourceUnavailableError";
  }
}

/**
 * Stable ID generator for source citations. Same URL always produces the
 * same ID — enables deduplication across adapters.
 */
export function sourceId(url: string): string {
  let h = 5381;
  for (let i = 0; i < url.length; i++) h = ((h * 33) ^ url.charCodeAt(i)) >>> 0;
  return `src_${h.toString(36)}`;
}
