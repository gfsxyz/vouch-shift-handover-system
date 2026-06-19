# ADR 0001 — Shift window and `?date=` semantics

- **Status:** accepted
- **Date:** 2026-06-19
- **Deciders:** project owner (grilling session, round 1)

## Context

A night shift runs ~23:00–07:00 in the hotel's local time (`+08:00`), so a single
physical shift spans **two calendar dates**. The API is specified as
`GET /api/handover?date=2026-05-30`. We must define, unambiguously, what that date
parameter means and which events belong to "that shift" — otherwise reconciliation,
classification, and grounding all inherit the ambiguity.

The data makes the ambiguity concrete: for the night of 29→30 May, events carry
timestamps on **both** sides of midnight — `evt_0018` at `2026-05-29T23:40` and
`evt_0014`/`evt_0019`/`evt_0020` at `2026-05-30T00:25–01:30`.

## Decision

`date` is **the morning the handover is for** — i.e. the date the morning manager
would put at the top of their handover. The shift window is:

```
window(D) = [ (D - 1) 23:00:00 , D 07:00:00 )   in +08:00
```

So `?date=2026-05-30` covers the night of **29 → 30 May**: `evt_0018`, `evt_0014`,
`evt_0019`, `evt_0020`, `evt_0021`, `evt_0022`, `evt_0023`, `evt_0025`, `evt_0026`.

The free-text night log is dated by its own header (night of 27 May → morning 28 May)
and is mapped into the window for `?date=2026-05-28`.

"Most recent shift" / "tonight" in the classification rules always means `window(D)`.
All events **before** `window(D)` start are "prior nights" for reconciliation.

## Options considered

1. **Morning the handover is for** *(chosen)* — matches how a 7am manager names the
   handover; groups a physical shift correctly even though it crosses midnight.
2. **Evening the shift started** — `date` = calendar date the shift began. Off-by-one
   from operator mental model ("this morning's handover"); rejected.
3. **Raw calendar date of each event** — ignore the cross-midnight shift. Simplest to
   code but splits one physical shift across two dates and contradicts the brief.

## Consequences

- The shift-windowing function is the single source of truth for "which shift" and is
  unit-testable independent of any model.
- Boundary events (e.g. `evt_0018` at 23:40) are correctly attributed to the upcoming
  morning, not the previous one. This must be covered by a test.
- Timezone is fixed per hotel (`+08:00` here, from `events.json`), not the server's
  local time — windowing always uses the hotel timezone.
- A handover can be requested for any historical date; the engine builds full thread
  history first, then slices classification at `window(D)` (see [ADR 0002](0002-issue-thread-identity.md)).
