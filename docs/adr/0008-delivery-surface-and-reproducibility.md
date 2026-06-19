# ADR 0008 — Delivery surface and reproducibility

- **Status:** accepted
- **Date:** 2026-06-19
- **Deciders:** project owner (grilling session, round 2)

## Context

The brief requires a curl-able, deployed endpoint and "a way to view the handover", while
preferring the simplest thing that works. We also need handovers to be **reproducible** —
the same date should yield the same handover — despite a model sitting in the extraction
stage.

## Decision

**JSON API is the source of truth; a minimal Next.js page renders it.**

- `GET /api/handover?date=YYYY-MM-DD` returns the handover as JSON (the curl target).
- `GET /api/debug?date=YYYY-MM-DD` exposes the full thread → event → evidence chain.
- A small Next.js page fetches the JSON and renders sections: **Action Required**,
  **New Tonight**, **Resolved Tonight**, **Requires Verification**, **FYI**, each item with
  an **evidence drawer** (the source ids + snippets).

**Response shape** (aligned with the brief's example, extended for verification):

```jsonc
{
  "hotel":   { "id": "lumen-sg", "name": "Lumen Boutique Hotel" },
  "shiftDate": "2026-05-30",
  "window":  { "from": "2026-05-29T23:00:00+08:00", "to": "2026-05-30T07:00:00+08:00" },
  "stillOpen":            [ /* items, carried over + unresolved */ ],
  "newTonight":           [ /* items, first seen this window */ ],
  "resolvedTonight":      [ /* items, were open before, closed tonight */ ],
  "requiresVerification": [ /* cross-cutting: contested/incomplete items */ ],
  "fyi":                  [ /* notable non-action items, e.g. 230 deposit waived */ ],
  "warnings":             [ /* pipeline/safety notes: injection flagged, night log not ingested */ ]
}
```

Each `item` = `{ threadId, title, room, category, state, summary, evidence: [sourceId…],
flags: [] }`. "Action Required" in the UI is a **view** derived from `stillOpen` +
contested items, not a separate stored bucket, so the JSON contract stays close to the
brief's. A contested item appears in both its lifecycle list and `requiresVerification`
([ADR 0005](0005-contradiction-and-dispute-state.md)).

**Runtime & reproducibility:**

- **In-memory** processing of the bundled `data/` files — no database
  ([ADR 0003](0003-llm-scope.md) keeps the only nondeterminism at extraction).
- Night-log **extraction is cached** (keyed by source content hash) at temperature 0, so
  repeated requests for the same date are byte-stable and don't re-hit the model.
- The engine reads input **as data** (the loader is swappable), so the service generalizes
  to night-log text we haven't seen, not just this sample.

## Options considered

1. **JSON API + minimal Next.js view** *(chosen)* — satisfies curl + "a way to view",
   reuses the existing Next.js/Tailwind/shadcn scaffold, keeps JSON reusable for
   Slack/email later.
2. **JSON API only** — leanest, but leaves "a way to view" at raw JSON; rejected given the
   scaffold already supports a cheap page.
3. **Server-rendered HTML only** — one surface, but no reusable API contract for downstream
   consumers; rejected.

## Consequences

- Deploy target is **Vercel** (Next.js native); the model API key is an env var, absent in
  which the service still serves the JSON pipeline and reports the night log as not ingested.
- The evidence drawer in the UI is the human-facing twin of `/api/debug` — both answer
  "why does the handover say this?".
- Caching means a changed night log must invalidate by content hash; documented so a future
  builder doesn't chase a "stale handover" ghost.
