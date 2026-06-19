# ADR 0002 — Issue-thread identity = (room, category)

- **Status:** accepted
- **Date:** 2026-06-19
- **Deciders:** project owner (grilling session, round 1)

## Context

The core of the system is the **issue thread**: the same real-world problem tracked
across nights and across both data sources. Reconciliation quality depends entirely on
grouping events into threads correctly. Two facts from the data force the design:

- **Room is not a unique issue key.** Room 309 holds *two* unrelated issues in the same
  stay: a booking-name/passport mismatch (`evt_0006`) and an uncollected deposit
  (`evt_0007`, `evt_0014`). They must not collapse into one thread.
- **Some issues are not room-bound.** The 2nd-floor corridor leak (`evt_0008` →
  `evt_0013`) and the immigration-reporting backlog (`evt_0003`, `evt_0009`, `evt_0019`,
  spanning rooms 204/207/210/211 across three nights) have `room: null` or many rooms.

We also need to join *across sources*: the Chinese night-log line "312 那个 no-show …
settle 了" must land on the same thread as the structured `evt_0010` no-show event.

## Decision

A thread's identity is a **deterministic composite key**: `(room, normalized_category)`.

- `112 + maintenance/aircon` → one thread across `evt_0002`, `evt_0018`, and the night-log
  aircon line.
- `309 + check_in_id` and `309 + deposit` → two distinct threads.
- Room-less / area issues key on **category only** (with an area tag): the corridor leak
  is one `facilities/leak` thread; the immigration backlog is one `compliance/immigration`
  thread regardless of which rooms' passports are involved.

Cross-source joining is **rule-based**, not model-based: Claude's only job is to extract
`room` + `category` (+ status + evidence snippet) from free text (see
[ADR 0003](0003-llm-scope.md)). Once the free-text line is a normalized event with a
`(room, category)`, it joins existing threads by the same deterministic key. The model
never decides thread membership.

Category normalization maps the raw `type` values and extracted topics onto a small
controlled vocabulary (see [glossary](../glossary.md)) so that e.g. `maintenance` and a
free-text "aircon" line share a category.

## Options considered

1. **(room, category) composite key** *(chosen)* — splits 309 correctly, threads
   room-less issues by category, keeps the join auditable.
2. **Room only** — simpler, but merges 309's two issues and cannot thread the leak,
   the immigration backlog, or walk-ins; rejected.
3. **LLM assigns thread membership** — flexible on messy input but non-deterministic and
   non-auditable; violates the "reconciliation must be deterministic" rule; rejected.

## Consequences

- We need a **category normalization map** and an explicit rule for which categories are
  room-keyed vs category-keyed (area issues). This lives in code and is documented.
- Cross-source matching is only as good as the model's room/category extraction, but a
  *wrong* extraction produces a *visible* mis-join (auditable in `/api/debug`), not a
  silent fabrication.
- Threads carry an ordered event timeline (by timestamp), which the state machine in
  reconciliation consumes; see [ADR 0004](0004-grounding-strategy.md) for how evidence
  rides along.
- Open question deferred to round 2: how a later guest *dispute* (`evt_0012`) or a
  *contradiction* (205) affects a thread that an earlier event marked resolved.
