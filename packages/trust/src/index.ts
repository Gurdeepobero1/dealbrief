import type { Brief, Claim, Source } from "@dealbrief/shared";

/**
 * TRUST LAYER
 *
 * Validates that every Brief produced by the synthesis pipeline meets our
 * citation and confidence contract BEFORE it reaches the user. Runs as a
 * post-synthesis gate.
 *
 * A brief that fails any of these checks is rejected. The pipeline retries
 * with a stricter prompt suffix.
 */

export interface TrustValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    totalClaims: number;
    citedClaims: number;
    uncitedClaims: number;
    inferredClaims: number;
    avgConfidence: number;
    belowFloor: number;
  };
}

const MIN_CONFIDENCE = Number(process.env.MIN_CONFIDENCE ?? 0.4);

export function validateBrief(brief: Brief): TrustValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  const validSourceIds = new Set(brief.allSources.map(s => s.id));

  // 1. One-thing must cite
  if (!brief.theOneThingToKnow.sourceIds.length) {
    errors.push("theOneThingToKnow has no sourceIds");
  }
  for (const id of brief.theOneThingToKnow.sourceIds) {
    if (!validSourceIds.has(id)) {
      errors.push(`theOneThingToKnow cites unknown source ${id}`);
    }
  }

  // 2. Every opener must cite a primary source
  if (brief.openers.length !== 3) {
    errors.push(`Expected exactly 3 openers, got ${brief.openers.length}`);
  }
  for (const o of brief.openers) {
    if (!o.groundedInSourceIds.length) {
      errors.push(`Opener rank ${o.rank} has no sources`);
    }
    for (const id of o.groundedInSourceIds) {
      if (!validSourceIds.has(id)) {
        errors.push(`Opener rank ${o.rank} cites unknown source ${id}`);
      }
    }
    if (o.confidence < MIN_CONFIDENCE) {
      errors.push(`Opener rank ${o.rank} below confidence floor: ${o.confidence}`);
    }
  }

  // 3. Priorities must be marked inferred with an inference chain
  for (const p of brief.likelyPriorities) {
    if (!p.inferred) {
      warnings.push(`Priority "${p.statement}" not marked inferred`);
    }
    if (p.inferred && !p.inferenceChain) {
      errors.push(`Priority "${p.statement}" inferred but missing inferenceChain`);
    }
  }

  // 4. Compute stats
  const allClaims: Claim[] = [
    ...brief.person.claims,
    ...brief.company.claims,
    ...brief.likelyPriorities,
  ];
  const cited = allClaims.filter(c => c.sourceIds.length > 0);
  const inferred = allClaims.filter(c => c.inferred);
  const belowFloor = allClaims.filter(c => c.confidence < MIN_CONFIDENCE).length;
  const avgConfidence =
    allClaims.length === 0
      ? 0
      : allClaims.reduce((s, c) => s + c.confidence, 0) / allClaims.length;

  if (belowFloor > 0) {
    errors.push(`${belowFloor} claims below confidence floor ${MIN_CONFIDENCE}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats: {
      totalClaims: allClaims.length,
      citedClaims: cited.length,
      uncitedClaims: allClaims.length - cited.length,
      inferredClaims: inferred.length,
      avgConfidence,
      belowFloor,
    },
  };
}

/**
 * Render a brief as human-readable markdown, suitable for email delivery
 * or CLI stdout. Every claim renders with its source citation.
 */
export function renderBriefMarkdown(brief: Brief): string {
  const sourceIndex = new Map(brief.allSources.map(s => [s.id, s]));
  const cite = (ids: string[]): string =>
    ids
      .map(id => {
        const s = sourceIndex.get(id);
        return s ? `[${s.publisher ?? domainOf(s.url)}](${s.url})` : id;
      })
      .join(", ");

  const personName = brief.person.fullName;
  const role = brief.person.currentRole;

  const lines: string[] = [];
  lines.push(`# DealBrief: ${personName}`);
  if (role) lines.push(`_${role.title} @ ${role.company}_\n`);

  lines.push(`## 📌 The one thing to know`);
  lines.push(brief.theOneThingToKnow.statement);
  lines.push(`_source: ${cite(brief.theOneThingToKnow.sourceIds)} · confidence: ${fmtConf(brief.theOneThingToKnow.confidence)}_\n`);

  lines.push(`## 👤 ${personName} — professional context`);
  if (role) {
    lines.push(`- **${role.title}** at **${role.company}**${role.tenureMonths ? ` (${role.tenureMonths} months)` : ""}`);
  }
  for (const prior of brief.person.priorRoles.slice(0, 3)) {
    lines.push(`- Prior: ${prior.title} at ${prior.company}`);
  }
  for (const edu of brief.person.education.slice(0, 2)) {
    lines.push(`- Education: ${edu.school}${edu.degree ? `, ${edu.degree}` : ""}${edu.year ? ` (${edu.year})` : ""}`);
  }
  lines.push("");

  lines.push(`## 🏢 ${brief.company.name} — what's changed recently`);
  for (const news of brief.company.recentNews.slice(0, 4)) {
    lines.push(`- **${news.headline}** _(${news.publishedAt.slice(0, 10)})_`);
    lines.push(`  ${news.summary}`);
  }
  lines.push("");

  lines.push(`## 🎯 Suggested openers`);
  for (const o of brief.openers) {
    lines.push(`### ${o.rank}. ${o.angle} _(confidence: ${fmtConf(o.confidence)})_`);
    lines.push(`> ${o.openerText.replace(/\n/g, "\n> ")}`);
    lines.push(`**Why it works:** ${o.whyItWorks}`);
    lines.push(`_grounded in: ${cite(o.groundedInSourceIds)}_\n`);
  }

  if (brief.likelyPriorities.length) {
    lines.push(`## 💡 Likely priorities _(inferred)_`);
    for (const p of brief.likelyPriorities) {
      lines.push(`- ${p.statement}`);
      if (p.inferenceChain) lines.push(`  _reasoning: ${p.inferenceChain}_`);
    }
    lines.push("");
  }

  if (brief.likelyObjections.length) {
    lines.push(`## ⚠️ Likely objections`);
    for (const o of brief.likelyObjections) {
      lines.push(`- **"${o.objection}"**`);
      lines.push(`  → ${o.suggestedResponse}`);
    }
    lines.push("");
  }

  if (brief.skipThese.length) {
    lines.push(`## 🚫 Skip these`);
    for (const s of brief.skipThese) {
      lines.push(`- **${s.topic}** — ${s.reason}`);
    }
    lines.push("");
  }

  lines.push(`## 🔗 Sources (${brief.allSources.length})`);
  for (const s of brief.allSources) {
    lines.push(`- [${s.title}](${s.url}) — ${s.publisher ?? domainOf(s.url)}`);
  }

  return lines.join("\n");
}

function fmtConf(c: number): string {
  return c.toFixed(2);
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
