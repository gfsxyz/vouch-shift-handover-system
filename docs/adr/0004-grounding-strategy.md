# ADR 0004 — Evidence-first assembly for grounding

- **Status:** accepted
- **Date:** 2026-06-19
- **Deciders:** project owner (grilling session, round 1)

## Context

Grounding is the part the brief cares about most: the handover "must not state anything
that isn't supported by the data" and must **flag** incomplete/contradictory entries
rather than paper over them. We need a *mechanism*, not a promise — something that makes
an ungrounded statement structurally hard to emit.

## Decision

**Evidence-first assembly.** Evidence flows from source to output by construction:

1. Every normalized event carries `evidence: { sourceId, text }[]` pointing at the exact
   source it came from (a JSON event id, or a stable `nightlog#NN` anchor + the verbatim
   snippet).
2. A normalized event from the night log is only admitted if the model returns a
   **source text snippet** that supports it; extractions that cannot be tied to a span of
   the log are **dropped**, not guessed.
3. Threads accumulate the evidence of their member events. State and classification are
   derived from those events' fields only.
4. The handover renders **from** threads: each handover item is templated from validated
   thread fields and exposes the union of its evidence ids.
5. A final **validation pass** asserts every evidence id referenced by any item resolves
   to a real source record; if not, the response fails closed rather than shipping an
   unsupported claim.

Because text is assembled *from* evidence rather than written *and then* cited, there is
no path that produces a sentence without a backing source.

### Incomplete / contradictory / uncertain input

- **Contradictions are never auto-resolved.** Room 205 (system: in-house through Sat;
  night log: bed unslept, no luggage) → "requires verification", not "checked out early".
  Room 312 no-show vs guest dispute → "charge disputed, requires investigation", not
  "refund" and not "charge confirmed".
- **Unknowns stay unknown.** The 3am wifi call from an unidentified upper-floor room →
  "possible wifi issue, room unknown, unconfirmed" — never "wifi issue resolved".
- These produce a **flag** on the item plus an entry in the handover's verification list.

## Options considered

1. **Evidence-first assembly + validation** *(chosen)* — grounding is structural; the
   model cannot emit an uncited statement.
2. **Post-hoc citation check** — let the model write, then verify ids exist. Catches more
   phrasing but trusts the model to cite honestly; rejected as the primary mechanism
   (kept as the round-5 validation idea).
3. **Schema + temperature 0 only** — lightest, but no hard guard against a fluent
   invented sentence; rejected.

## Consequences

- The normalized-event and thread types must carry evidence as a first-class field from
  the very first line of code — retrofitting it later is the classic way grounding rots.
- `/api/debug` can expose the full thread → event → evidence chain so a builder can answer
  "which hotel, which night, which issue, why" (the structured-logging requirement).
- Dropping unsupported extractions means we may *omit* a real issue the model phrased
  un-anchorably. We prefer a visible omission (still in `/api/debug` raw log) to an
  invented inclusion. This trade is logged here on purpose.
