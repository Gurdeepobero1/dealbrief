import { z } from "zod";

/**
 * Confidence scoring:
 *   0.85-1.0  — primary source (subject said it publicly themselves)
 *   0.65-0.84 — secondary (press release, named journalist, official filing)
 *   0.40-0.64 — tertiary/inferred (pattern-matched from aggregated signals)
 *   <0.40     — never surfaced
 */
export const ConfidenceSchema = z.number().min(0).max(1);

export const SourceSchema = z.object({
  id: z.string(),                    // stable ID for citation references
  url: z.string().url(),
  title: z.string(),
  publisher: z.string().optional(),
  fetchedAt: z.string().datetime(),
  sourceType: z.enum([
    "linkedin_profile",
    "linkedin_post",
    "company_website",
    "news_article",
    "press_release",
    "podcast",
    "github",
    "conference_talk",
    "blog_post",
    "substack",
    "sec_filing",
    "mca_filing",                    // India — Ministry of Corporate Affairs
    "crunchbase",
    "job_posting",
    "other",
  ]),
});
export type Source = z.infer<typeof SourceSchema>;

/**
 * Every claim in a brief MUST have at least one source and a confidence score.
 * This is the Trust Layer contract.
 */
export const ClaimSchema = z.object({
  statement: z.string(),
  sourceIds: z.array(z.string()).min(1),
  confidence: ConfidenceSchema,
  inferred: z.boolean().default(false),   // true = pattern-matched, not stated
  inferenceChain: z.string().optional(),  // required if inferred=true
});
export type Claim = z.infer<typeof ClaimSchema>;

/**
 * Sensitivity flag — what the Conversation Coach can and cannot reference.
 * Applied to every content item before it reaches the synthesis layer.
 */
export const SensitivitySchema = z.enum([
  "safe",                  // Freely usable in outreach
  "caution",               // Usable with care — e.g., recent job change
  "avoid",                 // Do not reference — e.g., inferred political view
  "excluded",              // Removed entirely, never seen by synthesis
]);
export type Sensitivity = z.infer<typeof SensitivitySchema>;

// ---- Person (public professional data only) --------------------------------

export const PersonSchema = z.object({
  fullName: z.string(),
  headline: z.string().optional(),
  currentRole: z.object({
    title: z.string(),
    company: z.string(),
    startedAt: z.string().optional(),
    tenureMonths: z.number().optional(),
  }).optional(),
  priorRoles: z.array(z.object({
    title: z.string(),
    company: z.string(),
    startedAt: z.string().optional(),
    endedAt: z.string().optional(),
  })).default([]),
  education: z.array(z.object({
    school: z.string(),
    degree: z.string().optional(),
    year: z.number().optional(),
  })).default([]),
  // City-level only. No street-level, ever.
  location: z.object({
    city: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
  // Only content the subject authored publicly under their own name.
  publishedContent: z.array(z.object({
    type: z.enum(["linkedin_post", "article", "podcast", "talk", "github"]),
    title: z.string(),
    url: z.string().url(),
    publishedAt: z.string().optional(),
    snippet: z.string().optional(),
    themes: z.array(z.string()).default([]),
  })).default([]),
  claims: z.array(ClaimSchema),
  sources: z.array(SourceSchema),
});
export type Person = z.infer<typeof PersonSchema>;

// ---- Company -------------------------------------------------------------

export const CompanySchema = z.object({
  name: z.string(),
  domain: z.string().optional(),
  industry: z.string().optional(),
  headcount: z.string().optional(),   // ranged, e.g. "51-200"
  funding: z.object({
    stage: z.string().optional(),
    totalRaised: z.number().optional(),
    lastRound: z.object({
      amount: z.number(),
      stage: z.string(),
      announcedAt: z.string(),
      leadInvestor: z.string().optional(),
    }).optional(),
  }).optional(),
  recentNews: z.array(z.object({
    headline: z.string(),
    url: z.string().url(),
    publishedAt: z.string(),
    summary: z.string(),
    relevance: z.number().min(0).max(1),
  })).default([]),
  hiringSignals: z.object({
    openRolesTotal: z.number().optional(),
    openRolesByFunction: z.record(z.string(), z.number()).optional(),
    surgeAreas: z.array(z.string()).default([]),
  }).optional(),
  techStack: z.array(z.string()).default([]),
  claims: z.array(ClaimSchema),
  sources: z.array(SourceSchema),
});
export type Company = z.infer<typeof CompanySchema>;

// ---- The Brief - final synthesis output ------------------------------------

export const OpenerSchema = z.object({
  rank: z.number().int().min(1).max(3),
  angle: z.string(),
  openerText: z.string(),
  whyItWorks: z.string(),
  groundedInSourceIds: z.array(z.string()).min(1),
  confidence: ConfidenceSchema,
});
export type Opener = z.infer<typeof OpenerSchema>;

export const BriefSchema = z.object({
  id: z.string(),
  generatedAt: z.string().datetime(),
  meetingContext: z.object({
    scheduledAt: z.string().datetime().optional(),
    durationMin: z.number().optional(),
    attendees: z.array(z.string()).default([]),
  }).optional(),
  person: PersonSchema,
  company: CompanySchema,
  theOneThingToKnow: z.object({
    statement: z.string(),
    sourceIds: z.array(z.string()).min(1),
    confidence: ConfidenceSchema,
  }),
  openers: z.array(OpenerSchema).length(3),
  likelyPriorities: z.array(ClaimSchema),
  likelyObjections: z.array(z.object({
    objection: z.string(),
    suggestedResponse: z.string(),
    confidence: ConfidenceSchema,
  })),
  skipThese: z.array(z.object({
    topic: z.string(),
    reason: z.string(),
  })),
  allSources: z.array(SourceSchema),
});
export type Brief = z.infer<typeof BriefSchema>;
