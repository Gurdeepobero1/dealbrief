import { llm, parseJSON } from "./llm.js";
import {
  BRIEF_SYNTHESIS_SYSTEM_PROMPT,
  buildSynthesisUserMessage,
} from "../prompts/brief.js";
import {
  SENSITIVITY_FILTER_SYSTEM_PROMPT,
  buildSensitivityUserMessage,
} from "../prompts/sensitivity.js";
import {
  RELEVANCE_RANKER_SYSTEM_PROMPT,
  buildRelevanceUserMessage,
} from "../prompts/relevance.js";
import type { Person, Company, Source, Brief } from "@dealbrief/shared";
import { BriefSchema } from "@dealbrief/shared";

export interface PipelineInput {
  person: Person;
  company: Company;
  sources: Source[];
  meetingContext?: {
    scheduledAt?: string;
    durationMin?: number;
    attendees?: string[];
  };
  sellerContext?: {
    productDescription: string;
    idealCustomerProfile: string;
    valueProps: string[];
  };
}

/**
 * Three-stage pipeline:
 *   1. Sensitivity filter — drop excluded items, flag avoid/caution
 *   2. Relevance ranker   — keep top ~15 items for the synthesis call
 *   3. Brief synthesis    — generate the final Brief
 */
export async function generateBrief(input: PipelineInput): Promise<Brief> {
  // ── Stage 1: Sensitivity filter ────────────────────────────────────────
  const contentItems = collectContentItems(input);

  const sensitivityRes = await llm({
    task: "sensitivity",
    temperature: 0.1,
    responseFormat: "json_object",
    messages: [
      { role: "system", content: SENSITIVITY_FILTER_SYSTEM_PROMPT },
      { role: "user", content: buildSensitivityUserMessage(contentItems) },
    ],
  });

  const sensitivity = parseJSON<{
    items: Array<{ id: string; label: string; reason: string }>;
  }>(sensitivityRes.content);

  const excludedIds = new Set(
    sensitivity.items.filter(i => i.label === "excluded").map(i => i.id)
  );
  const avoidItems = sensitivity.items.filter(i => i.label === "avoid");

  const safeItems = contentItems.filter(i => !excludedIds.has(i.id));

  // ── Stage 2: Relevance ranker ──────────────────────────────────────────
  const relevanceRes = await llm({
    task: "classification",
    temperature: 0.2,
    responseFormat: "json_object",
    messages: [
      { role: "system", content: RELEVANCE_RANKER_SYSTEM_PROMPT },
      {
        role: "user",
        content: buildRelevanceUserMessage({
          items: safeItems.map(i => ({
            id: i.id,
            type: i.type,
            summary: i.content.slice(0, 500),
            publishedAt: i.publishedAt,
          })),
          sellerContext: input.sellerContext
            ? {
                productDescription: input.sellerContext.productDescription,
                idealCustomerProfile: input.sellerContext.idealCustomerProfile,
              }
            : undefined,
        }),
      },
    ],
  });

  const ranked = parseJSON<{
    ranked: Array<{ id: string; relevance: number; why: string }>;
  }>(relevanceRes.content);

  const topIds = new Set(ranked.ranked.slice(0, 15).map(r => r.id));

  // ── Stage 3: Brief synthesis ──────────────────────────────────────────
  // Pass only top-ranked items + the avoid list into the synthesis prompt.
  const filteredPerson: Person = {
    ...input.person,
    publishedContent: input.person.publishedContent.filter(c =>
      topIds.has(hashId("pub", c.url))
    ),
  };

  const filteredCompany: Company = {
    ...input.company,
    recentNews: input.company.recentNews.filter(n =>
      topIds.has(hashId("news", n.url))
    ),
  };

  const synthesisRes = await llm({
    task: "synthesis",
    temperature: 0.4,
    responseFormat: "json_object",
    maxTokens: 3000,
    messages: [
      { role: "system", content: BRIEF_SYNTHESIS_SYSTEM_PROMPT },
      {
        role: "user",
        content:
          buildSynthesisUserMessage({
            person: filteredPerson,
            company: filteredCompany,
            sources: input.sources,
            meetingContext: input.meetingContext,
            sellerContext: input.sellerContext,
          }) +
          (avoidItems.length > 0
            ? `\n\nITEMS FLAGGED AS "avoid" (include in skipThese):\n${avoidItems
                .map(i => `- ${i.id}: ${i.reason}`)
                .join("\n")}`
            : ""),
      },
    ],
  });

  const synthesized = parseJSON<Omit<Brief, "id" | "generatedAt" | "person" | "company" | "allSources">>(
    synthesisRes.content
  );

  const brief: Brief = {
    id: `brief_${Date.now()}`,
    generatedAt: new Date().toISOString(),
    person: input.person,
    company: input.company,
    allSources: input.sources,
    meetingContext: input.meetingContext,
    ...synthesized,
  };

  // Validate against schema. If this throws, the LLM produced bad JSON.
  return BriefSchema.parse(brief);
}

// ── Helpers ──────────────────────────────────────────────────────────────

interface ContentItem {
  id: string;
  type: string;
  content: string;
  source: string;
  publishedAt?: string;
}

function collectContentItems(input: PipelineInput): ContentItem[] {
  const items: ContentItem[] = [];
  for (const pub of input.person.publishedContent) {
    items.push({
      id: hashId("pub", pub.url),
      type: pub.type,
      content: `${pub.title}\n${pub.snippet ?? ""}`,
      source: pub.url,
      publishedAt: pub.publishedAt,
    });
  }
  for (const news of input.company.recentNews) {
    items.push({
      id: hashId("news", news.url),
      type: "news",
      content: `${news.headline}\n${news.summary}`,
      source: news.url,
      publishedAt: news.publishedAt,
    });
  }
  return items;
}

function hashId(prefix: string, url: string): string {
  let h = 0;
  for (let i = 0; i < url.length; i++) h = (h * 31 + url.charCodeAt(i)) | 0;
  return `${prefix}_${Math.abs(h).toString(36)}`;
}
