# ADR 0010 — Route "pending" events by substance, not by label

- **Status:** accepted
- **Date:** 2026-06-19
- **Deciders:** project owner (grilling session, round 3)

## Context

The structured feed uses three status values: `resolved`, `unresolved`, and `pending`.
`pending` is overloaded — it covers genuinely different operational situations:

- `evt_0023` — room 226 cracked basin, night staff *proposes* a SGD 500 damage fee, but
  **no photos and no manager approval** on record.
- `evt_0017` — room 220 guest requested a deposit refund and invoice on early checkout.
- `evt_0016` — room 301 guest felt unwell, declined an ambulance, **logged for awareness**.
- `evt_0006` — room 309 booking-name/passport mismatch, entry allowed, **morning team to
  confirm with the OTA**.

If `pending` were a single bucket, a safety-awareness note, a money decision, and a refund
request would all land together — flattening exactly the urgency signal the handover exists
to convey.

## Decision

Treat `pending` as **"unsettled"** and route each item by its **category + grounding
completeness**, not by the raw status string:

| Event | Routed to | Why |
| --- | --- | --- |
| `evt_0023` damage fee | **Requires verification + Action Required** | Money action blocked on missing photos/approval — incomplete evidence |
| `evt_0017` refund request | **Action Required** | A concrete task the morning team must execute |
| `evt_0016` unwell guest | **FYI / awareness** | Logged for awareness; no open action, declined escalation |
| `evt_0006` OTA name confirm | **Still open / Action Required** | A carried task with a clear next step (confirm with OTA) |

The placement rule is deterministic: status seeds the lifecycle state, but the **notable
predicate** ([ADR 0006](0006-handover-scope-signal-vs-noise.md)) and the **completeness
check** ([ADR 0004](0004-grounding-strategy.md)) decide the section. A `pending` item whose
claim can't be fully grounded goes to *requires verification*; one with a clear actionable
next step goes to *Action Required*; one that is purely informational goes to *FYI*.

## Options considered

1. **Route by substance** *(chosen)* — most faithful to what a manager must actually do.
2. **Dedicated 'Awaiting' bucket** — predictable, but lumps a safety note with a money
   decision and a refund; flattens urgency; rejected.
3. **Treat pending as open** — simplest, but over-escalates the awareness-only incident and
   under-flags the damage item that genuinely needs verification; rejected.

## Consequences

- The category→section mapping (which categories are actionable vs. awareness-only) is
  explicit, documented, and unit-tested — the routing must be auditable, not implicit in
  the status field.
- `evt_0016`-style awareness items need a conservative "FYI, not action" classification so
  we neither bury a safety note nor cry wolf. Tested with this exact case as a fixture.
