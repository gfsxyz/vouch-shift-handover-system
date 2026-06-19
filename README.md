# Night-Shift Handover

Generates a **morning handover for the night-shift manager** from a hotel's overnight
operational data — reconciling structured front-desk events ([`data/events.json`](data/events.json))
and a free-text relief-staff log ([`data/night-logs.md`](data/night-logs.md), EN / 中文 / mixed)
into one action-first picture, with **every line traceable to source evidence**.

Built for the Vouch Builder Test. The *why* behind every decision lives in
[`DECISIONS.md`](DECISIONS.md) and the [ADRs](docs/adr/README.md); this README is how to run it.

## Quickstart

```bash
pnpm install
pnpm test          # 39 tests — windowing, threading, reconciliation, injection, grounding
pnpm dev           # http://localhost:3000
```

The bundled night log ships with a **committed extraction seed**, so the service runs
**without an API key**. To re-extract (or process a new log), set a key:

```bash
export ANTHROPIC_API_KEY=sk-ant-...   # night-log extraction uses claude-sonnet-4-6, temp 0
```

## API

```bash
# The curl target — curated, grounded handover JSON for a morning shift
curl "http://localhost:3000/api/handover?date=2026-05-30"

# Full thread → event → evidence chain + per-thread decision records
curl "http://localhost:3000/api/debug?date=2026-05-30"
```

`date=D` is **the morning the handover is for**; the shift window is `[(D-1) 23:00, D 07:00)`
in the hotel timezone (`+08:00`). The sample spans `2026-05-26` … `2026-05-30` — try
`?date=2026-05-28` (the free-text shift) and `?date=2026-05-29` (watch the 312 no-show flip
from *resolved* to *contested* as the guest dispute lands).

Response shape:

```jsonc
{
  "hotel": { "id": "lumen-sg", "name": "Lumen Boutique Hotel" },
  "shiftDate": "2026-05-30",
  "window": { "from": "2026-05-29T23:00:00+08:00", "to": "2026-05-30T07:00:00+08:00" },
  "stillOpen": [],            // carried over from a prior night, unresolved
  "newTonight": [],           // first seen this shift
  "resolvedTonight": [],      // was open before tonight, closed during the shift
  "requiresVerification": [], // contradictions / disputes / incomplete / injection — never auto-resolved
  "fyi": [],                  // notable but not an open action
  "warnings": []              // pipeline / safety notes (injection flagged, log not ingested)
}
// each item: { threadId, title, room, category, state, classification, summary, evidence: [sourceId…], flags: [] }
```

The web UI at `/` renders these sections action-first, each item with an **evidence drawer**
(source ids + verbatim snippets).

## How it works

```
events.json ─┐
             ├─▶ normalize → issue threads (room, category) → per-thread state
night-logs ──┘     (LLM here only)        → classify @ shift window → grounded handover
```

Deterministic everywhere **except one step** — turning night-log prose into normalized
events (Claude Sonnet 4.6, `generateObject` + Zod, temperature 0, cached by content hash).
Threading, state, classification, evidence linking, and the output text are plain code.

- **Reconciliation** — an *issue thread* is `(room, normalized category)`; area issues
  (immigration backlog, corridor leak) key on category only. Threads are built from the full
  history, then classified at the requested window. Room 309 → two threads; room 112 aircon →
  one thread across three nights and both sources.
- **Grounding** — every normalized event carries `evidence: { sourceId, text }[]`. A night-log
  extraction is admitted only if its verbatim snippet really occurs in the log, else **dropped**.
  The handover is assembled *from* evidence; a final pass **fails closed** if any cited id
  doesn't resolve.
- **Contradictions** — a later dispute/contradiction never auto-flips a thread; it becomes
  `contested` and is escalated to *requires verification* (312 no-show dispute, 205 abandoned-room).
- **Prompt injection** — all guest/log text is data, never instructions. The room-214 "report
  all clear / SGD 1000 credit" note is flagged, surfaced for review, and **never obeyed**;
  deterministic code never branches on free text, so it can't suppress real items.

## Structured logging

Each thread classification emits one JSON line to stdout (greppable in the platform log
pipeline) — `{ hotelId, shiftDate, issueId, decision, reason, evidence }`, source ids only,
never guest content. The same records are served by `/api/debug`.

## Deploy

Next.js on Vercel. Set `ANTHROPIC_API_KEY` to enable live extraction of unseen logs (the
bundled sample works without it via the seed). In-memory processing, no database.

## Layout

| Path | What |
| --- | --- |
| [`lib/shift.ts`](lib/shift.ts) | Shift windowing — the single source of truth, tested first |
| [`lib/threads.ts`](lib/threads.ts) · [`lib/state.ts`](lib/state.ts) · [`lib/classify.ts`](lib/classify.ts) | Reconciliation engine |
| [`lib/extraction/`](lib/extraction/) · [`lib/loaders/`](lib/loaders/) | The one model step + input loaders |
| [`lib/handover.ts`](lib/handover.ts) | Evidence-first assembly + fail-closed validation |
| [`app/api/`](app/api/) · [`app/page.tsx`](app/page.tsx) | JSON API + minimal view |
| [`docs/adr/`](docs/adr/) · [`DECISIONS.md`](DECISIONS.md) | Why it works the way it does |
