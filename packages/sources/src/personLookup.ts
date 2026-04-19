/**
 * Person lookup via Exa semantic search.
 *
 * Replaces Proxycurl. Searches the public web for LinkedIn profiles,
 * personal sites, and bios to build a best-effort person profile.
 * No paid LinkedIn API required.
 */
import { exa } from "./exa.js";

export interface PersonLookupQuery {
  linkedinUrl?: string;
  workEmail?: string;
  fullName?: string;
  companyDomain?: string;
}

export interface PersonProfile {
  fullName: string;
  headline?: string;
  bio?: string;
  linkedinUrl?: string;
  currentRole?: {
    title: string;
    company: string;
  };
  location?: string;
  snippets: string[];
  sourceUrls: string[];
}

export async function lookupPerson(
  query: PersonLookupQuery
): Promise<PersonProfile | null> {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) throw new Error("EXA_API_KEY not set");

  // Build the best search query we can from what we have
  const searchTerms: string[] = [];
  if (query.linkedinUrl) searchTerms.push(`site:linkedin.com "${query.linkedinUrl}"`);
  if (query.fullName) searchTerms.push(`"${query.fullName}"`);
  if (query.workEmail) {
    const namePart = query.workEmail.split("@")[0]?.replace(/[._]/g, " ");
    if (namePart) searchTerms.push(`"${namePart}"`);
  }
  if (query.companyDomain) searchTerms.push(query.companyDomain);

  if (searchTerms.length === 0) return null;

  const searchQuery = query.linkedinUrl
    ? `linkedin profile ${query.linkedinUrl}`
    : `${searchTerms.join(" ")} linkedin profile bio`;

  const results = await exa.fetch({
    query: searchQuery,
    type: "neural",
    numResults: 5,
    includeDomains: query.linkedinUrl
      ? ["linkedin.com"]
      : ["linkedin.com", "twitter.com", "github.com"],
  });

  if (results.length === 0) return null;

  // Extract person info from search results
  const snippets: string[] = [];
  const sourceUrls: string[] = [];
  let linkedinUrl: string | undefined = query.linkedinUrl;
  let headline: string | undefined;
  let currentTitle: string | undefined;
  let currentCompany: string | undefined;
  let location: string | undefined;

  for (const r of results) {
    sourceUrls.push(r.url);
    if (r.url.includes("linkedin.com/in/") && !linkedinUrl) {
      linkedinUrl = r.url;
    }
    if (r.highlights) snippets.push(...r.highlights);
    if (r.text) snippets.push(r.text.slice(0, 300));

    // Best-effort: extract headline from title (LinkedIn titles are usually "Name - Title at Company")
    if (!headline && r.url.includes("linkedin.com") && r.title) {
      const parts = r.title.split(" - ");
      if (parts.length >= 2) headline = parts.slice(1).join(" - ").trim();
      // Try to split "Title at Company"
      const atMatch = headline?.match(/^(.+?)\s+at\s+(.+)$/i);
      if (atMatch) {
        currentTitle = atMatch[1]?.trim();
        currentCompany = atMatch[2]?.trim();
      }
    }
  }

  // Derive best-guess full name
  let fullName = query.fullName;
  if (!fullName && query.workEmail) {
    fullName = query.workEmail
      .split("@")[0]
      ?.replace(/[._]/g, " ")
      .replace(/\b\w/g, c => c.toUpperCase());
  }
  if (!fullName && results[0]?.title) {
    // LinkedIn titles usually start with the person's name
    fullName = results[0].title.split(" - ")[0]?.trim();
  }
  if (!fullName) return null;

  return {
    fullName,
    headline,
    linkedinUrl,
    currentRole:
      currentTitle && currentCompany
        ? { title: currentTitle, company: currentCompany }
        : undefined,
    location,
    snippets: snippets.slice(0, 6),
    sourceUrls,
  };
}
