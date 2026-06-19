# DECISIONS

Reviewer-facing summary of the engineering decisions behind this service. Each decision
links to the full Architecture Decision Record under [`docs/adr/`](docs/adr/). The
[glossary](docs/glossary.md) defines the terms used here.

> **Status:** living document. Decisions are captured during a structured "grilling"
> design session before/while building, then revised if the build invalidates them.

## Decision log

| #   | Decision                                                                                                         | ADR                                                               |
| --- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1   | `?date=D` means the **morning the handover is for**; shift window = `[(D-1) 23:00, D 07:00)` `+08:00`            | [ADR 0001](docs/adr/0001-shift-and-date-semantics.md)             |
| 2   | Issue-thread identity = **(room, category)**; cross-source join is rule-based, model only extracts room/category | [ADR 0002](docs/adr/0002-issue-thread-identity.md)                |
| 3   | Claude runs at **extraction only**; threading, state, classification, output are deterministic                   | [ADR 0003](docs/adr/0003-llm-scope.md)                            |
| 4   | **Evidence-first assembly** + a final validation pass; contradictions/unknowns are flagged, never resolved       | [ADR 0004](docs/adr/0004-grounding-strategy.md)                   |
| 5   | A later **dispute/contradiction** makes a thread `contested` → **requires verification**, never auto-settled     | [ADR 0005](docs/adr/0005-contradiction-and-dispute-state.md)      |
| 6   | Manager view = **actionable + notable**; routine same-shift closures live in `/api/debug` only                   | [ADR 0006](docs/adr/0006-handover-scope-signal-vs-noise.md)       |
| 7   | **Prompt injection**: all content is data; flag the 214 note & log injection, never obey                         | [ADR 0007](docs/adr/0007-prompt-injection-handling.md)            |
| 8   | **JSON API + minimal Next.js view**; in-memory; extraction cached at temp 0 for reproducibility                  | [ADR 0008](docs/adr/0008-delivery-surface-and-reproducibility.md) |
| 9   | Night-log extraction uses **Claude Sonnet 4.6** (`claude-sonnet-4-6`, temp 0, Zod)                               | [ADR 0009](docs/adr/0009-extraction-model.md)                     |
| 10  | **"pending" routed by substance** (category + grounding completeness), not by label                              | [ADR 0010](docs/adr/0010-pending-status-routing.md)               |
| 11  | Decision logs as **stdout JSON lines + `/api/debug`** (hotel/night/issue/why)                                    | [ADR 0011](docs/adr/0011-structured-decision-logging.md)          |
| 12  | **Durable extraction cache** via committed real-run recordings (cheap + stateless-safe; unseen logs still live)   | [ADR 0012](docs/adr/0012-durable-extraction-cache.md)             |

---

The sections below are the answers the brief asks `DECISIONS.md` to cover. They are
filled in as decisions land; sections marked _pending_ are completed during/after the build.

## What was built — and what was deliberately skipped

**Built:** a deterministic reconciliation engine (shift windowing → `(room, category)`
threading across both sources → per-thread state machine → window classification), an
evidence-first handover assembler with a fail-closed grounding pass, a single Sonnet 4.6
extraction step (Zod, temp 0, injection-hardened) cached by **content hash**, `GET /api/handover`
and `GET /api/debug`, a server-rendered view with per-item evidence drawers, structured
per-thread decision logs to stdout, and a 39-test suite (windowing first, then threading,
reconciliation, contradictions, injection, and grounding/fail-closed).

Extraction is deterministic (temp 0), so a given log's result never changes. A **recording of
the real Sonnet run** for the bundled log is committed (`lib/extraction/recorded/<hash>.json`)
and ships in the deployment bundle, so a known log is a cache hit on every (stateless) cold
start — no model call, no per-request cost — while an **unseen** log misses the hash and is
extracted live. The recording is a genuine model output, not a hand-authored stand-in, and the
test suite reads it through the same cache path production uses (no key, no fixture priming).

**Skipped by design.** The brief is explicit that volume, visual polish, and "whether you
finish" are *not* being tested, and the graded qualities are normalization, reconciliation,
grounding, and judgment. So the budget went there, and the following were consciously left out
— each is an additive, reversible hardening step, not a hole in the core:

- **No web-app authentication / accounts / login.** Access control is orthogonal to the
  handover logic and would, in production, live at the edge (Vouch's existing SSO/gateway), not
  in this service. Adding it here spends budget on something the brief isn't grading.
- **No API protection (no bearer token / API key on `/api/handover` or `/api/debug`).** The
  endpoints are intentionally open so they can be hit with the plain `curl` the brief asks for
  as a deliverable. In production they'd sit behind the same auth as everything else, and
  `/api/debug` in particular — which exposes full evidence including verbatim guest content —
  would be access-restricted, not public.
- **No database / persistence (SQLite or otherwise).** In-memory only ([ADR 0008](docs/adr/0008-delivery-surface-and-reproducibility.md)).
  The week of data is bundled and processing is deterministic, so re-deriving a handover on each
  request is cheap and reproducible; a DB would add operational surface without improving any
  graded quality. The only state is an in-process extraction cache.
- **No UI polish and no action buttons.** The view is a deliberately plain, read-only
  "report" — sections plus evidence drawers, no styling beyond the theme, and **no** controls to
  acknowledge / resolve / charge / approve. Utility over beauty, but also a *safety* choice: a
  read-only surface has no side-effecting action that a tired operator — or an injected "apply a
  SGD 1000 credit" note — could ever trigger ([ADR 0007](docs/adr/0007-prompt-injection-handling.md)).
  Operators act in their existing tools; this surface only *tells them what to act on*.

Also deliberately **not** done: model-written prose (the output is templated from grounded
fields so it can't invent), and parsing the night-log's shift date from prose (it's supplied to
the loader as data, which is how real logs would carry it).

## Reconciliation across nights

The engine builds **full issue-thread history** from all events (both sources), then
slices classification at the requested shift window ([ADR 0001](docs/adr/0001-shift-and-date-semantics.md)).
Threads are identified by `(room, category)` so the same problem is tracked across nights
and across the JSON/free-text divide ([ADR 0002](docs/adr/0002-issue-thread-identity.md)).
For a given morning each thread is classified **still open / new tonight / resolved
tonight**, with **requires verification** as a cross-cutting flag. A later dispute or
contradiction never auto-settles a thread — it becomes `contested` and is escalated
([ADR 0005](docs/adr/0005-contradiction-and-dispute-state.md)). The manager view is curated
to **actionable + notable** items; routine same-shift closures remain in `/api/debug`
([ADR 0006](docs/adr/0006-handover-scope-signal-vs-noise.md)).

## Grounding & handling incomplete/contradictory input

Grounding is **structural, not promised**: every normalized event carries its
`{ sourceId, text }` evidence; the handover is assembled _from_ threads that already hold
evidence; a final pass fails closed if any cited id doesn't resolve
([ADR 0004](docs/adr/0004-grounding-strategy.md)). The only model in the pipeline is
extraction, constrained by Zod schema at temperature 0 and re-grounded against a required
source snippet ([ADR 0003](docs/adr/0003-llm-scope.md)). Contradictions (205, 312) become
"requires verification"; unknowns (3am wifi, unknown room) stay unknown; guest content
(room 214 injection) is data only and never obeyed.

## Where AI helped most / got in the way

**Helped most:** the multilingual, contradiction-laden night log — exactly where rules are
brittle. Sonnet read the mixed EN/中文 prose and pulled out that the 312 no-show was _settled_,
that the 205 line _contradicts the system_, that the 208 safe-box guest flies out in the
morning, and that the 3am wifi call is _unconfirmed_ — each as a typed field with a verbatim
snippet. Confining the model to that one extraction boundary meant all the trust-critical work
(threading, state, open/resolved decisions) stayed deterministic and testable.

**Got in the way:** the temptation to let the model do more. An earlier instinct was to have it
write the handover prose or decide thread membership — both reintroduce a hallucination surface
on the part the brief cares about most. The discipline that paid off was making grounding
_structural_ (drop any extraction whose snippet isn't in the log; assemble output only from
typed evidence; fail closed on a dangling id) rather than _prompted_ ("please cite your
sources"). A smaller annoyance: keyword heuristics on free text are easy to over-fit — an early
`incomplete_evidence` regex matched evt_0010's "NOT yet charged" and mis-flagged the no-show;
caught by a test, then tightened.

The most concrete "got in the way" only showed up once I ran the **real** model instead of a
hand-authored stand-in: Sonnet's first pass categorized the corridor leak as `maintenance`/room
215 and the abandoned-room 205 line as `early_checkout`. Both are _reasonable_ English readings,
but they diverged from the categories the structured feed uses (`facilities`/null and
`occupancy`), so the cross-source threads silently split — exactly the mis-join ADR 0002 warns
about. The fix wasn't to special-case the sample; it was to give the extraction prompt precise,
generalizable category definitions ("a leak / common-area issue → facilities, room null even if
a nearby room is named"; "an apparent unrecorded departure → occupancy, not early_checkout").
Lesson: when the model feeds a deterministic join key, the _vocabulary_ has to be pinned down as
tightly as the schema — the schema constrains shape, not meaning.

## What I'd do in hours 3–6

- **Per-thread grounded summaries (ADR 0003, option 2):** swap the templated lead line for a
  model-written summary _constrained to the thread's evidence snippets_, with a post-check that
  every sentence's facts appear in the evidence — better prose without loosening grounding.
- **Property-test the windowing/classification** across random dates/timezones, and add a DST
  hotel to prove the offset handling generalizes beyond `+08:00`.
- **Confidence + provenance on extractions**, and a `/api/debug` diff view so an operator can
  see _what changed_ between last night's handover and tonight's.
- **Golden-file regression** on the full handover JSON per date, so any pipeline change shows up
  as a reviewable diff.

## One thing that surprised me

How much of the "AI problem" turned out to be a **boring data-modeling problem**. Once the
shift window and the `(room, category)` thread key were pinned down, the hardest graded
behaviors — _resolved tonight vs already-resolved_, _settled-then-disputed_, _two sources
disagree_ — fell out of one rule: **classify a thread only from the events visible before
07:00, and never let a later conflict silently overwrite an earlier fact.** The 312 no-show
demonstrates it perfectly: the _same thread_ reads `resolved tonight` for `date=2026-05-28` and
`contested` for `date=2026-05-29`, with no special-casing — just the window moving forward over
an immutable event history.

---

## How these decisions were made

Decisions were elicited through a structured grilling session (the `grill-with-docs`
playbook): each load-bearing ambiguity in the dataset was turned into an explicit
question with grounded options, decided, and recorded as an ADR. This file is the index;
the ADRs hold the full context, the rejected options, and the consequences we accept.

## Time Allocation

Approximate focused time: 1.5–2 hours

- Brief review and data analysis
- Architecture and ADR decisions
- Implementation
- Testing and validation
- Documentation and deployment preparation

The exercise was completed in a single working session.
