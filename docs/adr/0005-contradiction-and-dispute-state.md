# ADR 0005 — Contradictions and disputes become "requires verification"

- **Status:** accepted
- **Date:** 2026-06-19
- **Deciders:** project owner (grilling session, round 2)
- **Resolves:** the open question left by [ADR 0002](0002-issue-thread-identity.md)

## Context

A thread's state is derived from its ordered events. But some threads contain events that
**conflict** rather than progress, and a naive "latest event wins" rule would silently
pick a side of a genuine dispute — exactly the failure mode the brief warns against.

The data has two concrete shapes:

- **Dispute of a settled action.** Room 312: no-show flagged, not charged (`evt_0010`) →
  night-log line says the no-show was charged/settled → guest **disputes** the charge,
  claims he cancelled at 21:00 (`evt_0012`). "Latest wins" would either confirm or reverse
  a charge that needs human adjudication.
- **Source contradiction.** Room 205: system shows Mr Chen in-house through Sat 30 May
  (`evt_0024`); the night-log rounds find the room abandoned, bed unslept, no luggage.
  "Latest wins" would declare an early checkout that was never recorded.

## Decision

A later **dispute or contradiction does not auto-flip** a thread's state. The thread enters
state **`contested`** and is flagged **requires verification**:

- It is surfaced under **Action Required** (a contested money/occupancy item is something a
  manager must act on), and
- It is listed in **requires verification** with both conflicting pieces of evidence
  attached, and
- Its summary states the conflict plainly ("charge disputed — guest claims cancellation
  within window; not verified") — never "refund", never "charge confirmed", never
  "checked out early".

Detection is deterministic: a thread is `contested` when (a) an event of a designated
*dispute* category (e.g. `finance_note` disputing a prior charge) follows a settling event,
or (b) two events in the thread assert mutually exclusive facts (occupancy, charge state)
that the rules cannot reconcile. When in doubt, the rules **escalate to contested** rather
than guess.

## Options considered

1. **Becomes 'requires verification' / contested** *(chosen)* — never silently settles a
   real conflict; matches "do not auto-resolve contradictions".
2. **Latest event wins** — chronological and simple, but resolves the conflict the manager
   is supposed to adjudicate; rejected.
3. **Keep prior state until a human acts** — stable, but buries the conflict as a note
   instead of escalating it; rejected.

## Consequences

- `contested` is a real thread state alongside open/resolved/pending; the state machine and
  its tests must cover "settle then dispute" and "two sources disagree".
- A contested item appears in **two** lists (its lifecycle list *and* requires-verification)
  — intentional; verification is a cross-cutting flag, not a lifecycle stage
  ([glossary](../glossary.md)).
- We accept that the engine will sometimes flag a "contradiction" that a human would
  reconcile at a glance (e.g. a stale source). Over-flagging is safe; silent resolution is
  not.
