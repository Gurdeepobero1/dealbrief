/**
 * Proxycurl adapter — LinkedIn public profile data.
 *
 * LEGAL BASIS: Proxycurl operates a licensed data pipeline. We consume their
 * API, we do not scrape LinkedIn directly. This is the approved pattern used
 * by Clay, Clearbit, Apollo, and every compliant enrichment tool.
 *
 * Docs: https://nubela.co/proxycurl/docs
 */
import type { SourceAdapter } from "./types.js";
import { sourceId, RateLimitError } from "./types.js";

export interface ProxycurlQuery {
  linkedinUrl?: string;
  workEmail?: string;
}

export interface ProxycurlProfile {
  fullName: string;
  headline?: string;
  occupation?: string;
  city?: string;
  country?: string;
  experiences: Array<{
    title: string;
    company: string;
    startsAt?: { year: number; month?: number };
    endsAt?: { year: number; month?: number };
    description?: string;
  }>;
  education: Array<{
    school: string;
    degreeName?: string;
    fieldOfStudy?: string;
    startsAt?: { year: number };
    endsAt?: { year: number };
  }>;
  activities: Array<{
    title: string;
    link: string;
    activityStatus: string;
  }>;
  publicIdentifier: string;
  sourceUrl: string;
}

export const proxycurl: SourceAdapter<ProxycurlQuery, ProxycurlProfile | null> = {
  name: "proxycurl",
  sourceType: "linkedin_profile",
  licenseNote:
    "Proxycurl licensed pipeline. Public professional data only. Subject to DPA.",

  async fetch(query: ProxycurlQuery): Promise<ProxycurlProfile | null> {
    const apiKey = process.env.PROXYCURL_API_KEY;
    if (!apiKey) throw new Error("PROXYCURL_API_KEY not set");

    let url: string;
    if (query.linkedinUrl) {
      url = `https://nubela.co/proxycurl/api/v2/linkedin?url=${encodeURIComponent(query.linkedinUrl)}`;
    } else if (query.workEmail) {
      url = `https://nubela.co/proxycurl/api/linkedin/profile/resolve/email?work_email=${encodeURIComponent(query.workEmail)}`;
    } else {
      throw new Error("Proxycurl requires linkedinUrl or workEmail");
    }

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (res.status === 429) {
      throw new RateLimitError(60_000);
    }
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(`Proxycurl error ${res.status}: ${await res.text()}`);
    }

    const raw = (await res.json()) as Record<string, unknown>;
    return normalizeProxycurl(raw, query.linkedinUrl ?? "");
  },
};

function normalizeProxycurl(raw: Record<string, unknown>, url: string): ProxycurlProfile {
  // Proxycurl returns snake_case. Normalize to camelCase and trim to
  // the fields we actually use. Anything we don't list here is dropped —
  // an explicit allowlist, not a filter.
  const r = raw as {
    full_name: string;
    headline?: string;
    occupation?: string;
    city?: string;
    country?: string;
    experiences?: Array<{
      title: string;
      company: string;
      starts_at?: { year: number; month?: number };
      ends_at?: { year: number; month?: number };
      description?: string;
    }>;
    education?: Array<{
      school: string;
      degree_name?: string;
      field_of_study?: string;
      starts_at?: { year: number };
      ends_at?: { year: number };
    }>;
    activities?: Array<{ title: string; link: string; activity_status: string }>;
    public_identifier: string;
  };

  return {
    fullName: r.full_name,
    headline: r.headline,
    occupation: r.occupation,
    city: r.city,
    country: r.country,
    experiences: (r.experiences ?? []).map(e => ({
      title: e.title,
      company: e.company,
      startsAt: e.starts_at,
      endsAt: e.ends_at,
      description: e.description,
    })),
    education: (r.education ?? []).map(e => ({
      school: e.school,
      degreeName: e.degree_name,
      fieldOfStudy: e.field_of_study,
      startsAt: e.starts_at,
      endsAt: e.ends_at,
    })),
    activities: (r.activities ?? []).map(a => ({
      title: a.title,
      link: a.link,
      activityStatus: a.activity_status,
    })),
    publicIdentifier: r.public_identifier,
    sourceUrl: url || `https://linkedin.com/in/${r.public_identifier}`,
  };
}

export { sourceId };
