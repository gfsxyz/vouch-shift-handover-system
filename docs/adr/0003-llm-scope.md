# ADR 0003 — Claude runs at extraction only

- **Status:** accepted
- **Date:** 2026-06-19
- **Deciders:** project owner (grilling session, round 1)

## Context

The brief encourages using a model wherever the input is messy or non-English — the
night log is English / 中文 / mixed, informal, and contradictory — *as long as every
statement traces back to source*. The risk is that a model placed too late in the
pipeline invents facts, reorders priorities, or "tidies up" contradictions, which is
exactly what this product must never do when running unattended across hundreds of hotels.

## Decision

Claude runs at **exactly one stage: extraction.** It turns free-text night-log prose into
**normalized events** via `generateObject` + a Zod schema, at **temperature 0**.

Everything after extraction is **deterministic code**:

- threading / cross-source joining ([ADR 0002](0002-issue-thread-identity.md)),
- per-thread state derivation (open / resolved / pending / contested),
- cross-night classification (still open / new tonight / resolved tonight / requires
  verification),
- evidence linking and the final handover text (templated from grounded fields).

The structured `events.json` is parsed **without any model** — its schema is stable, so
an LLM there would only add nondeterminism and cost.

## Options considered

1. **Extraction only** *(chosen)* — model confined to natural-language understanding; the
   trustworthy, reproducible core is plain code. Best fit for "runs unattended."
2. **Extraction + per-thread grounded summaries** — nicer prose, but reintroduces a
   model into the output path with a (small) invent-a-fact surface to guard.
3. **Extraction + full handover draft** — best prose, weakest grounding guarantee;
   rejected as untrustworthy at fleet scale.

## Consequences

- Handover text is **templated**, so it may read a little mechanically. We accept that —
  an operator trusts a boring-but-true handover over a fluent one. (Revisit in hours 3–6
  if prose quality matters; option 2 is the upgrade path.)
- The only place that can hallucinate is extraction, and its output is **constrained by
  schema and re-grounded** against the source snippet before use ([ADR 0004](0004-grounding-strategy.md)).
- Reproducibility: temperature 0 + schema makes extraction near-deterministic; we cache
  extraction results per source so repeated handover requests don't re-hit the model and
  stay byte-stable.
- Extraction failures (model down, invalid object) degrade gracefully: the structured
  JSON pipeline still produces a handover; the night log is reported as
  "not ingested — manual review" rather than silently dropped.
