# DealBrief Privacy & Data Practices

_Last updated: April 2026_

DealBrief exists because we believe meeting prep should respect the person on the other side of the call. This document describes, in plain language, exactly what data we use, where it comes from, and what we refuse to touch.

## Our data principle

**Public-footprint intelligence, not surveillance.**

We use only data that the subject has chosen to make public themselves — LinkedIn profile, their published posts, their podcast appearances, their company's press releases, their company's funding announcements, their company's job postings. We build insight by *combining* these public signals, not by accessing anything the subject did not publish.

## What DealBrief uses

**Professional identity (public):**
- LinkedIn profile data via Proxycurl (licensed API)
- Current role, prior roles, education, city-level location
- Publicly shared LinkedIn posts, articles, podcasts, conference talks

**Company context (public):**
- Funding announcements and press releases
- News articles (via Exa.ai semantic search)
- Public job postings
- Publicly disclosed tech stack (via BuiltWith)
- Regulatory filings (MCA for India, SEC for US, Companies House for UK)

**Technical identity (public, if relevant):**
- GitHub public activity

## What DealBrief refuses to use

- ❌ Personal social media (Instagram, personal X/Twitter, Facebook)
- ❌ Phone number reverse lookup
- ❌ Breach data of any kind, even if publicly available
- ❌ Inferred personal attributes: relationship status, family, children
- ❌ Health, disability, mental health
- ❌ Religion, political affiliation, political donations
- ❌ Sexual orientation, gender identity (beyond what's explicitly public professional)
- ❌ Race, ethnicity
- ❌ Physical appearance, age
- ❌ Home address, neighborhood
- ❌ Salary, compensation, net worth
- ❌ Content from sources behind authentication walls
- ❌ Scraped data from any platform that prohibits scraping in its ToS

## Confidence scoring

Every claim in a DealBrief has a confidence score:

- **0.85–1.0**: the subject said this themselves publicly (primary source)
- **0.65–0.84**: press release, official filing, named journalist (secondary)
- **0.40–0.64**: inferred from multiple signals (tertiary)
- **Below 0.40**: not shown

Inferences are always labeled as such, with the reasoning chain visible.

## Your right to be removed

If you don't want DealBrief to generate briefs about you:

1. Go to `dealbrief.io/me`
2. Enter your work email or LinkedIn URL
3. Verify ownership (click a link sent to that email)
4. One-click deletion removes all cached data about you within 24 hours

You can also email `privacy@dealbrief.io`. We respond within 72 hours.

## Data retention

- Cached enrichment data: 7 days, then refetched
- Generated briefs: retained on the user's account until they delete them
- Subject deletion requests: honored within 24 hours, logged for audit

## Legal basis

- **India (DPDP Act 2023)**: our processing of publicly available data made public by the subject themselves falls within Section 3's publicly-available-data provisions. We honor deletion requests per Section 12.
- **EU/UK (GDPR)**: legitimate interest under Article 6(1)(f) for B2B professional contexts, balanced against subject rights. DPIA on file. DPA available for enterprise customers.
- **US (CCPA/CPRA)**: we honor Do Not Sell / Do Not Share and deletion requests.

## Transparency report

We publish a quarterly transparency report at `dealbrief.io/transparency` covering:
- Deletion requests received and response times
- Data sources added or removed
- Aggregate volume of briefs generated
- Any legal requests received

## Questions

`privacy@dealbrief.io` · `legal@dealbrief.io`
