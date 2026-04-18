# Prompt Changelog

Prompts are the moat. Every change here is tracked so we can A/B test and roll back.

## v0.1.0 — 2026-04-18

Initial prompt suite:
- `brief.ts` — core synthesis, 3-opener output, citation contract
- `sensitivity.ts` — 4-level classifier (safe/caution/avoid/excluded)
- `relevance.ts` — content ranker for meeting context

### Known gaps (to address in v0.2.0)
- Opener rubric currently relies on self-scoring by the LLM. Consider a separate critic pass.
- Language detection is implicit. Add explicit language parameter for multilingual support.
- No persona-specific templates (CTO vs VP Ops vs Founder). Consider role-conditioned prompts in v0.3.
- Inference chains are free-text. Consider structured inference format for auditability.

### A/B tests to run once there's traffic
- Temperature 0.3 vs 0.4 vs 0.5 on opener creativity
- 2 openers vs 3 openers (cognitive load)
- With vs without sellerContext (does personalization improve with seller's own ICP/valueProps?)
