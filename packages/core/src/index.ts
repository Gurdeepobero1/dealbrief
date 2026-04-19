import {
  proxycurl,
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
  // ── 1. Person fetch ───────────────────────────────────────────────────
  const profile = await proxycurl.fetch({
    linkedinUrl: input.linkedinUrl,
    workEmail: input.workEmail,
  });

  if (!profile) {
    throw new Error(
      "Could not resolve person. Pass a LinkedIn URL or work email with a public profile."
    );
  }

  // ── 2. Parallel enrichment ────────────────────────────────────────────
  const companyName =
    profile.experiences[0]?.company ?? input.companyDomain ?? "Unknown";

  // Best-effort GitHub lookup — guess username from LinkedIn handle
  const githubGuess = profile.publicIdentifier;

  const [newsResults, githubResult, podcastResults] = await Promise.allSettled([
    companyNewsLast90Days(companyName, input.companyDomain),
    github.fetch({ username: githubGuess }),
    listenNotes.fetch({ guestName: profile.fullName }),
  ]);

  const news = newsResults.status === "fulfilled" ? newsResults.value : [];
  const gh = githubResult.status === "fulfilled" ? githubResult.value : null;
  const podcasts =
    podcastResults.status === "fulfilled" ? podcastResults.value : [];

  // ── 3. Build normalized Person ────────────────────────────────────────
  const sources: Source[] = [];
  const personClaims: Claim[] = [];

  // LinkedIn profile itself is a source
  const linkedinSrc: Source = {
    id: sourceId(profile.sourceUrl),
    url: profile.sourceUrl,
    title: `${profile.fullName} — LinkedIn Profile`,
    publisher: "linkedin.com",
    fetchedAt: new Date().toISOString(),
    sourceType: "linkedin_profile",
  };
  sources.push(linkedinSrc);

  if (profile.headline) {
    personClaims.push({
      statement: `Headline: ${profile.headline}`,
      sourceIds: [linkedinSrc.id],
      confidence: 0.95,
      inferred: false,
    });
  }

  // LinkedIn activities = published content
  const publishedContent: Person["publishedContent"] = [];
  for (const a of profile.activities.slice(0, 10)) {
    const srcId = sourceId(a.link);
    sources.push({
      id: srcId,
      url: a.link,
      title: a.title.slice(0, 120),
      publisher: "linkedin.com",
      fetchedAt: new Date().toISOString(),
      sourceType: "linkedin_post",
    });
    publishedContent.push({
      type: "linkedin_post",
      title: a.title.slice(0, 120),
      url: a.link,
      themes: [],
    });
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

  const currentExp = profile.experiences[0];
  const person: Person = {
    fullName: profile.fullName,
    headline: profile.headline,
    currentRole: currentExp
      ? {
          title: currentExp.title,
          company: currentExp.company,
          startedAt: currentExp.startsAt
            ? `${currentExp.startsAt.year}-${String(currentExp.startsAt.month ?? 1).padStart(2, "0")}`
            : undefined,
          tenureMonths: currentExp.startsAt
            ? monthsSince(currentExp.startsAt.year, currentExp.startsAt.month ?? 1)
            : undefined,
        }
      : undefined,
    priorRoles: profile.experiences.slice(1, 4).map(e => ({
      title: e.title,
      company: e.company,
      startedAt: e.startsAt ? `${e.startsAt.year}` : undefined,
      endedAt: e.endsAt ? `${e.endsAt.year}` : undefined,
    })),
    education: profile.education.slice(0, 3).map(e => ({
      school: e.school,
      degree: e.degreeName,
      year: e.endsAt?.year,
    })),
    location: {
      city: profile.city,
      country: profile.country,
    },
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
    name: companyName,
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
