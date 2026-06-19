# ADR 0011 — Structured decision logging: JSON lines to stdout + `/api/debug`

- **Status:** accepted
- **Date:** 2026-06-19
- **Deciders:** project owner (grilling session, round 3)

## Context

The brief requires structured logging another builder (or an AI agent) could use to debug
a bad handover in production — answering *which hotel, which night, which issue, why*. The
decision record shape is specified:

```json
{
  "hotelId": "lumen-sg",
  "shiftDate": "2026-05-30",
  "issueId": "room-112-aircon",
  "decision": "still_open",
  "reason": "latest linked event unresolved",
  "evidence": ["evt_0002", "nightlog#01", "evt_0018"]
}
```

## Decision

Emit **one structured JSON line per thread classification to stdout**, *and* expose the
same decision records via **`GET /api/debug?date=YYYY-MM-DD`**.

- **stdout JSON lines** land in the platform's log pipeline (Vercel function logs),
  greppable after the fact for any past request — the production debugging path.
- **`/api/debug`** returns the full thread → event → evidence chain plus the per-thread
  decision records for the requested date — the on-demand inspection path, and the data
  source behind the UI's evidence drawer ([ADR 0008](0008-delivery-surface-and-reproducibility.md)).

Both carry the same record shape, so a record seen in logs can be reproduced exactly via
the endpoint. Every record's `evidence` is the union of its thread's source ids, tying the
log back to grounding ([ADR 0004](0004-grounding-strategy.md)).

## Options considered

1. **JSON lines to stdout + `/api/debug`** *(chosen)* — inspectable two ways, no storage
   to manage, matches the platform's log model.
2. **Only in `/api/debug`** — easy on-demand inspection, but nothing in deployment logs to
   debug a specific past request after the fact; rejected.
3. **Write to a log file** — durable within a process, but the deploy target is
   serverless (ephemeral filesystem) and it bypasses the platform log pipeline; rejected.

## Consequences

- A tiny structured-logger helper writes the record at the moment each thread is
  classified — so the log is produced *by* the decision, not reconstructed after, keeping
  `reason` honest to the actual rule that fired.
- Logs are per-thread, not per-event, matching the unit a debugger reasons about ("why is
  room 112 still open?").
- No PII beyond what's already in the source data; guest names appear only where the source
  event carries them, and never the body of an injection note (only a flag) — consistent
  with [ADR 0007](0007-prompt-injection-handling.md).
