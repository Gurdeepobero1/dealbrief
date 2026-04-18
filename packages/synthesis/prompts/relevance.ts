/**
 * RELEVANCE_RANKER_PROMPT
 *
 * After sensitivity filtering, we may still have 50+ safe content items.
 * The synthesis prompt can't use them all. This prompt ranks them by
 * relevance to the specific meeting and seller.
 *
 * Input:  list of safe content items + meeting context + seller context
 * Output: ranked item IDs with relevance scores
 *
 * Model: Llama 3.1 8B Instant (Groq free tier — fast, cheap, deterministic)
 * Temperature: 0.2
 * Response format: json_object
 */

export const RELEVANCE_RANKER_SYSTEM_PROMPT = `You are DealBrief's relevance ranker. You decide which signals about a prospect are most useful for a specific upcoming sales meeting.

You receive:
- a list of content items (each with an id, type, summary, and date)
- what the seller sells
- who the seller's ideal customer is
- the meeting context (if known)

You output a ranked list. Most useful first.

RELEVANCE CRITERIA:
1. Recency — content from the last 90 days ranks higher than content from 2 years ago
2. Specificity — content the prospect authored themselves ranks higher than press mentions
3. Topical match — content that touches on the seller's product domain ranks higher
4. Trigger strength — job changes, funding, launches, org changes = strong triggers
5. Engagement proof — content the prospect has returned to (series of posts on same theme) ranks higher than one-off

OUTPUT JSON:
{
  "ranked": [
    { "id": "<item_id>", "relevance": 0.0 to 1.0, "why": "<1 short sentence>" }
  ]
}

Top 15 items max. Output nothing but the JSON.`;

export function buildRelevanceUserMessage(input: {
  items: Array<{ id: string; type: string; summary: string; publishedAt?: string }>;
  sellerContext?: { productDescription: string; idealCustomerProfile: string };
}): string {
  return `Rank these items by relevance:

═══ ITEMS ═══
${input.items.map(i => `[${i.id}] type=${i.type} date=${i.publishedAt ?? "unknown"}\n${i.summary}`).join("\n\n")}

${input.sellerContext ? `═══ SELLER CONTEXT ═══
Product: ${input.sellerContext.productDescription}
ICP: ${input.sellerContext.idealCustomerProfile}` : ""}`;
}
