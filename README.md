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
cp .env.example .env.local          # then add your key (see below)
pnpm dev                            # http://localhost:3000
```

### The API key

Night-log extraction is **always a real Claude Sonnet 4.6 call** — there is no pre-baked
extraction. The bundled sample is processed exactly like any unseen log, so the service
needs a key to ingest the free-text log:

```bash
# .env.local  (gitignored; Next.js auto-loads it)
ANTHROPIC_API_KEY=sk-ant-...
```

Without a key the structured (`events.json`) pipeline still produces a handover; the
free-text shift is reported as **not ingested** in `warnings` (graceful degradation, ADR 0003).

`pnpm test` runs **offline and deterministic** (39 tests) by priming the cache from a fixture
**recorded from a real Sonnet run** ([tests/fixtures/nightlog-extraction.json](tests/fixtures/nightlog-extraction.json)) —
the production code never reads it.

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

Next.js on Vercel. Set `ANTHROPIC_API_KEY` (the extraction step calls Sonnet 4.6 for every
night log, sample or unseen). In-memory processing, no database; extraction results are
cached in-process by content hash, and the cache only ever holds outputs of a real model run.

## Re-recording the extraction fixture

The offline test fixture is a recording of a real Sonnet run. To refresh it after changing the
extraction prompt or schema, clear the cache and re-run extraction with a key set, then save
the result to `tests/fixtures/nightlog-extraction.json` (it is validated against the Zod schema
and the grounding check before it is written).

## Layout

| Path | What |
| --- | --- |
| [`lib/shift.ts`](lib/shift.ts) | Shift windowing — the single source of truth, tested first |
| [`lib/threads.ts`](lib/threads.ts) · [`lib/state.ts`](lib/state.ts) · [`lib/classify.ts`](lib/classify.ts) | Reconciliation engine |
| [`lib/extraction/`](lib/extraction/) · [`lib/loaders/`](lib/loaders/) | The one model step + input loaders |
| [`lib/handover.ts`](lib/handover.ts) | Evidence-first assembly + fail-closed validation |
| [`app/api/`](app/api/) · [`app/page.tsx`](app/page.tsx) | JSON API + minimal view |
| [`docs/adr/`](docs/adr/) · [`DECISIONS.md`](DECISIONS.md) | Why it works the way it does |
