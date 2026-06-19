# ADR 0006 — Handover scope: actionable + notable, not everything

- **Status:** accepted
- **Date:** 2026-06-19
- **Deciders:** project owner (grilling session, round 2)

## Context

The handover must let a manager know "what's on fire, what's pending, what's just FYI"
within 60 seconds — explicitly **not** a chronological retelling. But the data is full of
routine events that opened and closed cleanly within one shift and carry no consequence:
smooth check-ins (`evt_0001`, `evt_0020`), a walk-in turned away (`evt_0011`), noise
complaints resolved same-night (`evt_0004`, `evt_0021`), a keycard reissued after ID check
(`evt_0005`), a parcel held at the desk (`evt_0022`). Including them all would bury the
three immigration/aircon/deposit fires under operational chatter.

## Decision

The manager-facing handover shows **actionable + notable** items only:

- **still open** (carried-over, unresolved),
- **resolved tonight** (was open before tonight, closed during the shift) — the wins,
- **new tonight** that are *notable* (a new issue, a money/compliance/safety item, or an
  explicit note left for the morning team),
- **requires verification** (contradictions/unknowns).

A routine event is **excluded** from the manager view when it (a) opened **and** closed
within the same shift window, (b) has no carryover thread, and (c) has no money,
compliance, safety, or explicit-handover-note implication. So `evt_0004`/`evt_0021`
(noise resolved) and `evt_0011` (walk-in) drop out, while the 230 deposit-waived note
(`evt_0025`) and the 214 flagged note (`evt_0026`) are kept as FYI because they exist
specifically to inform the morning team.

**Nothing is deleted.** Every excluded event remains in `/api/debug` and the structured log
with full evidence, so traceability is total even though the headline view is curated.

## Options considered

1. **Filter to actionable + notable** *(chosen)* — serves the 60-second goal; full detail
   stays one click away in debug.
2. **Include everything by status** — maximally complete but dilutes the signal; rejected
   as the *default* view (it is essentially what `/api/debug` provides).
3. **Open + verification only** — sharpest, but drops "resolved tonight" wins and notable
   FYIs the brief asks for; rejected.

## Consequences

- We need an explicit, testable **"notable"** predicate (money / compliance / safety /
  carryover / handover-note). Its rules are documented and unit-tested so the curation is
  auditable, not vibes.
- The split between "manager view" (curated) and `/api/debug` (complete) is a load-bearing
  product boundary, not just a convenience.
- Risk: the predicate could hide something a manager wanted. Mitigation: the predicate is
  conservative (when unsure, include as FYI) and debug always has the full set.
