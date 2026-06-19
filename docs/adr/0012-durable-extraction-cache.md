# ADR 0012 — Durable extraction cache via committed recordings (statelessness & cost)

- **Status:** accepted
- **Date:** 2026-06-19
- **Deciders:** project owner
- **Refines:** [ADR 0008](0008-delivery-surface-and-reproducibility.md)

## Context

[ADR 0008](0008-delivery-surface-and-reproducibility.md) caches night-log extraction by source
content hash for reproducibility. In local dev that cache is in-memory plus a write to
`.cache/`. On the deploy target (Vercel, **stateless serverless**) neither survives a request:

- every cold start gets an **empty** in-memory cache, and
- the function filesystem is **read-only**, so the `.cache/` write throws and is swallowed.

So in production the cache never persisted — **every cold render re-called Sonnet**. Combined
with a `force-dynamic` page and `<Link>` prefetching three date variants, a single page visit
fanned out into several extractions. Observed burn: ~**USD 0.5/minute** of model spend for
output that, at temperature 0, never changes. We had earlier removed a *hand-authored* seed
(rightly — it was simulated), but "always live" on stateless infra means re-billing for a
deterministic result on every request.

## Decision

Commit a **content-addressed recording of the real Sonnet run** for the bundled log at
`lib/extraction/recorded/<hash>.json`, and read it as a cache layer:

```
in-memory  →  committed recording (lib/extraction/recorded/)  →  runtime .cache/
```

The recording ships **inside the deployment bundle** (read-only but readable), so a known log
is a **cache hit on every cold start — no model call, no per-request cost**. An **unseen** log
has a different content hash, misses every layer, and is **extracted live** (needs a key). The
recording is a genuine model output (reproducible at temp 0), not a hand-authored stand-in, so
it satisfies "cached results must originate from a real model execution". The date-nav links are
also set `prefetch={false}` so the page stops firing background server renders.

## Options considered

1. **Committed recording (chosen)** — durable on stateless infra, ~zero cost for known logs,
   unseen logs still go live, no database, and the bundled demo is cheap and reproducible.
2. **External durable cache (Vercel KV / Blob / Redis)** — also caches *unseen* logs across cold
   starts, but adds a stateful service the brief says to avoid; rejected for this slice (it is
   the upgrade path if real fleet volume needs it).
3. **Stay always-live, accept the cost** — simplest, but re-bills per request on serverless for
   a deterministic output; rejected (the observed spend is both real and pointless).
4. **Precompute at build into the function bundle** — equivalent to the recording; the committed
   file is the simplest form of it.

## Consequences

- The bundled demo costs essentially nothing to serve and survives cold starts.
- A changed `data/night-logs.md` changes the hash, invalidating the recording → a fresh live
  extraction (key required). The re-record step is documented in the README.
- An unseen log still costs one live call per cold instance (no durable cache for it); acceptable
  for this slice, with option 2 as the scale-up path.
- Reinforces [ADR 0003](0003-llm-scope.md)/[0009](0009-extraction-model.md) (model only at
  extraction) and [ADR 0008](0008-delivery-surface-and-reproducibility.md) (reproducibility): the
  recording is byte-stable, and the tests read it through the same cache path production uses.
