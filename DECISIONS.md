# DECISIONS

Reviewer-facing summary of the engineering decisions behind this service. Each decision
links to the full Architecture Decision Record under [`docs/adr/`](docs/adr/). The
[glossary](docs/glossary.md) defines the terms used here.

> **Status:** living document. Decisions are captured during a structured "grilling"
> design session before/while building, then revised if the build invalidates them.

## Decision log

| # | Decision | ADR |
| - | -------- | --- |
| 1 | `?date=D` means the **morning the handover is for**; shift window = `[(D-1) 23:00, D 07:00)` `+08:00` | [ADR 0001](docs/adr/0001-shift-and-date-semantics.md) |
| 2 | Issue-thread identity = **(room, category)**; cross-source join is rule-based, model only extracts room/category | [ADR 0002](docs/adr/0002-issue-thread-identity.md) |
| 3 | Claude runs at **extraction only**; threading, state, classification, output are deterministic | [ADR 0003](docs/adr/0003-llm-scope.md) |
| 4 | **Evidence-first assembly** + a final validation pass; contradictions/unknowns are flagged, never resolved | [ADR 0004](docs/adr/0004-grounding-strategy.md) |
| 5 | A later **dispute/contradiction** makes a thread `contested` → **requires verification**, never auto-settled | [ADR 0005](docs/adr/0005-contradiction-and-dispute-state.md) |
| 6 | Manager view = **actionable + notable**; routine same-shift closures live in `/api/debug` only | [ADR 0006](docs/adr/0006-handover-scope-signal-vs-noise.md) |
| 7 | **Prompt injection**: all content is data; flag the 214 note & log injection, never obey | [ADR 0007](docs/adr/0007-prompt-injection-handling.md) |
| 8 | **JSON API + minimal Next.js view**; in-memory; extraction cached at temp 0 for reproducibility | [ADR 0008](docs/adr/0008-delivery-surface-and-reproducibility.md) |
| 9 | Night-log extraction uses **Claude Sonnet 4.6** (`claude-sonnet-4-6`, temp 0, Zod) | [ADR 0009](docs/adr/0009-extraction-model.md) |
| 10 | **"pending" routed by substance** (category + grounding completeness), not by label | [ADR 0010](docs/adr/0010-pending-status-routing.md) |
| 11 | Decision logs as **stdout JSON lines + `/api/debug`** (hotel/night/issue/why) | [ADR 0011](docs/adr/0011-structured-decision-logging.md) |

---

The sections below are the answers the brief asks `DECISIONS.md` to cover. They are
filled in as decisions land; sections marked _pending_ are completed during/after the build.

## What was built — and what was deliberately skipped

_Pending build._ Skipped by design (per brief): authentication, user/account management,
admin dashboards, multi-hotel support, persistence beyond in-memory, production
infra/scaling, and visual polish. The budget goes to normalization, cross-night
reconciliation, grounding, and evidence traceability.

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
`{ sourceId, text }` evidence; the handover is assembled *from* threads that already hold
evidence; a final pass fails closed if any cited id doesn't resolve
([ADR 0004](docs/adr/0004-grounding-strategy.md)). The only model in the pipeline is
extraction, constrained by Zod schema at temperature 0 and re-grounded against a required
source snippet ([ADR 0003](docs/adr/0003-llm-scope.md)). Contradictions (205, 312) become
"requires verification"; unknowns (3am wifi, unknown room) stay unknown; guest content
(room 214 injection) is data only and never obeyed.

## Where AI helped most / got in the way

_Pending build._

## What I'd do in hours 3–6

_Pending — captured at end of session._

## One thing that surprised me

_Pending — captured at end of session._

---

## How these decisions were made

Decisions were elicited through a structured grilling session (the `grill-with-docs`
playbook): each load-bearing ambiguity in the dataset was turned into an explicit
question with grounded options, decided, and recorded as an ADR. This file is the index;
the ADRs hold the full context, the rejected options, and the consequences we accept.
