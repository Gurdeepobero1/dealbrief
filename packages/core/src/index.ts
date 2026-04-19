import {
  lookupPerson,
  exa,
  github,
  listenNotes,
  companyNewsLast90Days,
  sourceId,
} from "@dealbrief/sources";
import { generateBrief } from "@dealbrief/synthesis";
import { validateBrief, renderBriefMarkdown } from "@dealbrief/trust";
import type {
  Person,
  Company,
  Source,
  Brief,
  Claim,
} from "@dealbrief/shared";

export interface PrepInput {
  // One of these is required
  linkedinUrl?: string;
  workEmail?: string;
  // Optional — lets us pull company news even if LinkedIn lookup fails
  companyDomain?: string;
  // Seller context improves opener quality significantly
  sellerContext?: {
    productDescription: string;
    idealCustomerProfile: string;
    valueProps: string[];
  };
  meetingContext?: {
    scheduledAt?: string;
    durationMin?: number;
    attendees?: string[];
  };
}

export interface PrepOutput {
  brief: Brief;
  markdown: string;
  validation: ReturnType<typeof validateBrief>;
}

/**
 * End-to-end: LinkedIn URL or email → fetched signals → filtered →
 * ranked → synthesized Brief. This is what the CLI, extension, and
 * web dashboard all call.
 */
export async function prepBrief(input: PrepInput): Promise<PrepOutput> {
  // ── 1. Person lookup via Exa web search ──────────────────────────────
  const profile = await lookupPerson({
    linkedinUrl: input.linkedinUrl,
    workEmail: input.workEmail,
    companyDomain: input.companyDomain,
  });

  const emailUser = input.workEmail?.split("@")[0]?.replace(/[._]/g, " ") ?? "";
  const guessedName = profile?.fullName ?? (emailUser || "Unknown Person");
  const guessedCompany =
    profile?.currentRole?.company ?? input.companyDomain ?? "Unknown";

  // ── 2. Parallel enrichment ────────────────────────────────────────────
  const githubGuess = profile?.linkedinUrl?.split("/in/")[1]?.replace(/\/$/, "") ?? emailUser.split(" ")[0] ?? "";

  const [newsResults, githubResult, podcastResults] = await Promise.allSettled([
    companyNewsLast90Days(guessedCompany, input.companyDomain),
    githubGuess ? github.fetch({ username: githubGuess }) : Promise.resolve(null),
    listenNotes.fetch({ guestName: guessedName }),
  ]);

  const news = newsResults.status === "fulfilled" ? newsResults.value : [];
  const gh = githubResult.status === "fulfilled" ? githubResult.value : null;
  const podcasts =
    podcastResults.status === "fulfilled" ? podcastResults.value : [];

  // ── 3. Build normalized Person ────────────────────────────────────────
  const sources: Source[] = [];
  const personClaims: Claim[] = [];
  const publishedContent: Person["publishedContent"] = [];

  if (profile) {
    for (const url of profile.sourceUrls) {
      const isLinkedin = url.includes("linkedin.com");
      const src: Source = {
        id: sourceId(url),
        url,
        title: `${profile.fullName} — ${isLinkedin ? "LinkedIn Profile" : "Web Profile"}`,
        publisher: new URL(url).hostname,
        fetchedAt: new Date().toISOString(),
        sourceType: isLinkedin ? "linkedin_profile" : "other",
      };
      sources.push(src);
      if (profile.headline) {
        personClaims.push({
          statement: `Headline: ${profile.headline}`,
          sourceIds: [src.id],
          confidence: 0.8,
          inferred: false,
        });
      }
    }
    for (const snippet of profile.snippets) {
      publishedContent.push({
        type: "article",
        title: snippet.slice(0, 120),
        url: profile.linkedinUrl ?? profile.sourceUrls[0] ?? "",
        themes: [],
      });
    }
  }

  // GitHub repos = more signal
  if (gh) {
    const ghSrc: Source = {
      id: sourceId(gh.profileUrl),
      url: gh.profileUrl,
      title: `${gh.username} on GitHub`,
      publisher: "github.com",
      fetchedAt: new Date().toISOString(),
      sourceType: "github",
    };
    sources.push(ghSrc);
    for (const repo of gh.recentRepos.slice(0, 5)) {
      publishedContent.push({
        type: "github",
        title: `${repo.name}${repo.description ? ` — ${repo.description}` : ""}`,
        url: repo.url,
        publishedAt: repo.updatedAt,
        themes: repo.language ? [repo.language] : [],
      });
    }
  }

  // Podcast appearances
  for (const p of podcasts) {
    sources.push({
      id: p.sourceId,
      url: p.url,
      title: p.title,
      publisher: p.podcastName,
      fetchedAt: new Date().toISOString(),
      sourceType: "podcast",
    });
    publishedContent.push({
      type: "podcast",
      title: p.title,
      url: p.url,
      publishedAt: p.publishedAt,
      snippet: p.description,
      themes: [],
    });
  }

  const person: Person = {
    fullName: guessedName,
    headline: profile?.headline,
    currentRole: profile?.currentRole
      ? { title: profile.currentRole.title, company: profile.currentRole.company }
      : undefined,
    priorRoles: [],
    education: [],
    location: profile?.location ? { city: profile.location } : undefined,
    publishedContent,
    claims: personClaims,
    sources: sources.filter(s => s.sourceType !== "news_article"),
  };

  // ── 4. Build normalized Company ──────────────────────────────────────
  const companyClaims: Claim[] = [];
  const recentNews: Company["recentNews"] = [];

  for (const n of news) {
    const newsSrc: Source = {
      id: n.id,
      url: n.url,
      title: n.title,
      publisher: domainOf(n.url),
      fetchedAt: new Date().toISOString(),
      sourceType: "news_article",
    };
    sources.push(newsSrc);
    recentNews.push({
      headline: n.title,
      url: n.url,
      publishedAt: n.publishedDate ?? new Date().toISOString(),
      summary: (n.text ?? n.highlights?.join(" ") ?? "").slice(0, 400),
      relevance: 0.7,
    });
  }

  const company: Company = {
    name: guessedCompany,
    domain: input.companyDomain,
    recentNews,
    claims: companyClaims,
    techStack: [],
    sources: sources.filter(s => s.sourceType === "news_article"),
  };

  // ── 5. Synthesize ────────────────────────────────────────────────────
  const brief = await generateBrief({
    person,
    company,
    sources,
    meetingContext: input.meetingContext,
    sellerContext: input.sellerContext,
  });

  // ── 6. Validate ─────────────────────────────────────────────────────
  const validation = validateBrief(brief);
  if (!validation.valid) {
    console.warn(
      "[dealbrief] trust validation warnings:",
      validation.errors.join("; ")
    );
    // In production we'd retry with a stricter suffix here.
  }

  const markdown = renderBriefMarkdown(brief);
  return { brief, markdown, validation };
}

function monthsSince(year: number, month: number): number {
  const now = new Date();
  return (now.getFullYear() - year) * 12 + (now.getMonth() + 1 - month);
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "web";
  }
}
