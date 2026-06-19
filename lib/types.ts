// Shared vocabulary for the handover pipeline.
// Terms here mirror docs/glossary.md and the ADRs. Keep this small and load-bearing.

/** Where a fact came from. See glossary "Source". */
export type Source = "json" | "night_log"

/** A pointer to the exact source record/snippet that supports a claim (ADR 0004). */
export interface Evidence {
  /** A JSON event id (`evt_0002`) or a stable night-log anchor (`nightlog#03`). */
  sourceId: string
  /** The verbatim snippet that grounds the claim. */
  text: string
}

/** Raw status as it appears in events.json / extraction. */
export type RawStatus = "resolved" | "unresolved" | "pending"

/**
 * Normalized issue category — the small controlled vocabulary that lets JSON `type`
 * values and model-extracted topics join into the same thread (ADR 0002, glossary).
 */
export type Category =
  | "maintenance" // aircon / repairs (room-keyed)
  | "facilities" // leaks / common-area (AREA-keyed)
  | "compliance" // immigration / passport scanning (AREA-keyed)
  | "deposit"
  | "no_show"
  | "damage"
  | "complaint" // noise / breakfast etc.
  | "check_in_id" // booking-name / passport mismatch
  | "occupancy" // check-in lifecycle / in-house vs vacated
  | "incident" // guest welfare
  | "safe_box"
  | "early_checkout"
  | "guest_message" // notes handed in (incl. injection)
  | "connectivity" // wifi
  | "keycard"
  | "walk_in" // (AREA-keyed)
  | "finance" // finance notes not tied to a charge dispute
  | "note" // misc desk note (parcel)

/**
 * Per-event flags. These are the ONLY signals downstream code branches on — never the
 * free text itself (ADR 0007). They drive contested-state detection and verification.
 */
export type EventFlag =
  | "prompt_injection" // text imitates instructions to this tool (ADR 0007)
  | "unconfirmed" // an unknown fact that must stay unknown (ADR 0004)
  | "incomplete_evidence" // a claim missing required backing (e.g. damage w/o photos)
  | "disputes_prior" // a later event disputes a settled action (ADR 0005)
  | "contradicts_system" // a source contradicts a structured record (ADR 0005)
  | "urgent"

/** A single fact reduced to one shared shape regardless of source (glossary). */
export interface NormalizedEvent {
  /** `evt_0002` (json) or `nightlog#03` (night log). */
  id: string
  source: Source
  /** ISO 8601 with the hotel offset, e.g. `2026-05-30T00:25:00+08:00`. */
  timestamp: string
  /** Epoch milliseconds — the comparison key for windowing. */
  ts: number
  /** Raw json `type`, or `night_log` for extracted events. */
  type: string
  room: string | null
  category: Category
  guest: string | null
  /** Verbatim (json) or normalized grounded summary (night log). */
  description: string
  status: RawStatus
  evidence: Evidence[]
  flags: EventFlag[]
}

/** Lifecycle state of a thread (glossary). `contested` is never silently flipped. */
export type ThreadState = "open" | "resolved" | "pending" | "contested"

/** Classification of a thread at a given shift window (glossary). */
export type Classification =
  | "still_open"
  | "new_tonight"
  | "resolved_tonight"
  | "dormant" // not surfaced at this window (e.g. already-resolved before tonight)

/** The same real-world problem tracked across nights and sources (ADR 0002). */
export interface IssueThread {
  /** Stable composite key, e.g. `room-112::maintenance` or `area::compliance`. */
  id: string
  room: string | null
  category: Category
  /** True when keyed on category only (area issue), ignoring room. */
  areaKeyed: boolean
  /** Member events, ordered by timestamp ascending. */
  events: NormalizedEvent[]
  /** Union of member evidence (ADR 0004). */
  evidence: Evidence[]
}

/** A rendered handover line. Assembled FROM thread evidence, never written then cited. */
export interface HandoverItem {
  threadId: string
  title: string
  room: string | null
  category: Category
  state: ThreadState
  classification: Classification
  summary: string
  /** Source ids only — the human/debug surfaces resolve these to snippets. */
  evidence: string[]
  flags: EventFlag[]
}

/** The curl target shape (ADR 0008). */
export interface Handover {
  hotel: { id: string; name: string }
  shiftDate: string
  window: { from: string; to: string }
  stillOpen: HandoverItem[]
  newTonight: HandoverItem[]
  resolvedTonight: HandoverItem[]
  requiresVerification: HandoverItem[]
  fyi: HandoverItem[]
  warnings: string[]
}

/** One structured decision record per thread classification (ADR 0011). */
export interface DecisionRecord {
  hotelId: string
  shiftDate: string
  issueId: string
  decision: string
  reason: string
  evidence: string[]
}

export interface Hotel {
  id: string
  name: string
  timezone: string
}
