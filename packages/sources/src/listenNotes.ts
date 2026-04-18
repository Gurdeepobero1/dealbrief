/**
 * Listen Notes adapter — podcast appearances.
 *
 * LEGAL BASIS: Listen Notes is the podcast industry's canonical search API.
 * Podcasts are public. Guest appearances are public.
 *
 * Docs: https://www.listennotes.com/api/docs
 */
import type { SourceAdapter } from "./types.js";
import { sourceId } from "./types.js";

export interface ListenNotesQuery {
  guestName: string;
}

export interface PodcastAppearance {
  title: string;
  podcastName: string;
  url: string;
  publishedAt?: string;
  description?: string;
  sourceId: string;
}

export const listenNotes: SourceAdapter<ListenNotesQuery, PodcastAppearance[]> = {
  name: "listen_notes",
  sourceType: "podcast",
  licenseNote: "Listen Notes commercial API. Indexes public podcast metadata.",

  async fetch(query: ListenNotesQuery): Promise<PodcastAppearance[]> {
    const apiKey = process.env.LISTEN_NOTES_API_KEY;
    if (!apiKey) return [];  // Optional source — skip if not configured

    const url = new URL("https://listen-api.listennotes.com/api/v2/search");
    url.searchParams.set("q", query.guestName);
    url.searchParams.set("type", "episode");
    url.searchParams.set("only_in", "title,description");

    const res = await fetch(url, {
      headers: { "X-ListenAPI-Key": apiKey },
    });

    if (!res.ok) return [];

    const json = (await res.json()) as {
      results: Array<{
        title_original: string;
        podcast: { title_original: string };
        link: string;
        pub_date_ms: number;
        description_original?: string;
      }>;
    };

    return json.results.slice(0, 10).map(r => ({
      title: r.title_original,
      podcastName: r.podcast.title_original,
      url: r.link,
      publishedAt: new Date(r.pub_date_ms).toISOString(),
      description: r.description_original?.replace(/<[^>]+>/g, "").slice(0, 500),
      sourceId: sourceId(r.link),
    }));
  },
};
