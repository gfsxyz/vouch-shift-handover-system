# ADR 0009 — Night-log extraction model: Claude Sonnet 4.6

- **Status:** accepted
- **Date:** 2026-06-19
- **Deciders:** project owner (grilling session, round 3)

## Context

The single LLM step ([ADR 0003](0003-llm-scope.md)) extracts normalized events from
free-text night logs via the AI SDK's `generateObject` + a Zod schema at temperature 0.
The input is short, informal, and multilingual (English / 中文 / mixed) with grounding-
critical nuance — e.g. the Chinese line that the 312 no-show was *settled/charged*, the
208 safe-box guest who flies out in the morning, and uncertainty/contradiction cues. Per-
hotel volume is low (one prose log only when the system is down), but extraction accuracy
directly bounds grounding quality.

Model options considered (cached pricing, per MTok input/output):

| Model | Price | Context | Notes |
| --- | --- | --- | --- |
| Claude Haiku 4.5 | $1 / $5 | 200K | Cheapest/fastest; small risk on nuanced 中文 |
| **Claude Sonnet 4.6** | **$3 / $15** | **1M** | Balanced multilingual nuance vs. cost |
| Claude Opus 4.8 | $5 / $25 | 1M | Highest fidelity; overkill for schema-constrained extraction |

## Decision

Use **Claude Sonnet 4.6** (`claude-sonnet-4-6`) for night-log extraction.

It carries the multilingual nuance the grounding step depends on while costing
materially less and running faster than Opus. The work is schema-constrained and low-
volume, so Opus's extra capability buys little here; Haiku is viable but carries a small
risk on the most subtle Chinese lines that we'd rather not take on the part of the system
the brief cares about most. Configuration: temperature 0, Zod-schema structured output,
extraction cached by source content hash ([ADR 0008](0008-delivery-surface-and-reproducibility.md)).

## Consequences

- The model id is a single config constant; swapping to Haiku (cost) or Opus (max
  fidelity) is a one-line change if fleet economics or accuracy needs shift.
- Sonnet 4.6 supports adaptive thinking, but for deterministic extraction we keep the
  call simple (no thinking display needed) — the schema is the contract.
- Extraction still degrades gracefully: if the model/key is unavailable, the JSON pipeline
  produces a handover and the night log is reported as not ingested
  ([ADR 0003](0003-llm-scope.md)), so model choice never becomes a single point of failure.
- Reproducibility holds because extraction output is cached; a model change invalidates
  the cache by design.
