# Architecture Decision Records

Each ADR captures one decision, the context that forced it, the option we picked,
the options we rejected, and the consequences we accept. They are the "why" behind
the code; [`../../DECISIONS.md`](../../DECISIONS.md) is the reviewer-facing summary that
links back here.

Status values: `accepted`, `superseded by ADR-XXXX`, `proposed`.

| ADR | Title | Status |
| --- | ----- | ------ |
| [0001](0001-shift-and-date-semantics.md) | Shift window and `?date=` semantics | accepted |
| [0002](0002-issue-thread-identity.md) | Issue-thread identity = (room, category) | accepted |
| [0003](0003-llm-scope.md) | Claude runs at extraction only | accepted |
| [0004](0004-grounding-strategy.md) | Evidence-first assembly for grounding | accepted |
| [0005](0005-contradiction-and-dispute-state.md) | Contradictions/disputes → requires verification | accepted |
| [0006](0006-handover-scope-signal-vs-noise.md) | Handover scope: actionable + notable | accepted |
| [0007](0007-prompt-injection-handling.md) | Prompt injection: flag, never obey | accepted |
| [0008](0008-delivery-surface-and-reproducibility.md) | Delivery surface & reproducibility | accepted |
| [0009](0009-extraction-model.md) | Extraction model: Claude Sonnet 4.6 | accepted |
| [0010](0010-pending-status-routing.md) | Route "pending" events by substance | accepted |
| [0011](0011-structured-decision-logging.md) | Decision logs: stdout JSON + /api/debug | accepted |

See also the [glossary](../glossary.md) for the vocabulary these ADRs assume.
