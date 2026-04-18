/**
 * Exa.ai adapter — semantic web search for news and signals.
 *
 * LEGAL BASIS: Exa indexes publicly accessible web content and operates as a
 * search engine. We query their API for news about companies. Results include
 * only public URLs; we do not access paywalled content.
 *
 * Docs: https://docs.exa.ai
 */
import type { SourceAdapter } from "./types.js";
import { sourceId } from "./types.js";

export interface ExaQuery {
  query: string;
  type?: "auto" | "neural" | "keyword";
  numResults?: number;
  startPublishedDate?: string;     // ISO date, e.g. "2026-01-18"
  includeDomains?: string[];
  excludeDomains?: string[];
}

export interface ExaResult {
  id: string;                       // our stable source ID
  title: string;
  url: string;
  publishedDate?: string;
  author?: string;
  text?: string;                    // extracted page text
  highlights?: string[];
}

export const exa: SourceAdapter<ExaQuery, ExaResult[]> = {
  name: "exa",
  sourceType: "news_article",
  licenseNote:
    "Exa.ai semantic search over public web. Returns public URLs + extracts.",

  async fetch(query: ExaQuery): Promise<ExaResult[]> {
    const apiKey = process.env.EXA_API_KEY;
    if (!apiKey) throw new Error("EXA_API_KEY not set");

    const res = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        query: query.query,
        type: query.type ?? "auto",
        numResults: query.numResults ?? 10,
        startPublishedDate: query.startPublishedDate,
        includeDomains: query.includeDomains,
        excludeDomains: query.excludeDomains,
        contents: {
          text: { maxCharacters: 2000 },
          highlights: { numSentences: 3, highlightsPerUrl: 2 },
        },
      }),
    });

    if (!res.ok) {
      throw new Error(`Exa error ${res.status}: ${await res.text()}`);
    }

    const json = (await res.json()) as {
      results: Array<{
        title: string;
        url: string;
        publishedDate?: string;
        author?: string;
        text?: string;
        highlights?: string[];
      }>;
    };

    return json.results.map(r => ({
      id: sourceId(r.url),
      title: r.title,
      url: r.url,
      publishedDate: r.publishedDate,
      author: r.author,
      text: r.text,
      highlights: r.highlights,
    }));
  },
};

/**
 * Convenience: last-90-days news for a company domain.
 */
export async function companyNewsLast90Days(
  companyName: string,
  companyDomain?: string
): Promise<ExaResult[]> {
  const ninety = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  return exa.fetch({
    query: `${companyName} funding OR launch OR hiring OR announcement OR earnings`,
    startPublishedDate: ninety,
    numResults: 15,
    // Slight domain preference — company site, reputable business news
    includeDomains: companyDomain ? [companyDomain] : undefined,
  });
}
