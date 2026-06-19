// Evidence-first handover assembly (ADR 0004, 0006, 0010).
//
// Output is built FROM threads that already carry evidence — never written and then cited.
// Each item is templated from validated thread fields and exposes the union of its visible
// evidence ids. A final validation pass fails closed if any cited id doesn't resolve.
//
// The manager view is curated to actionable + notable items (ADR 0006); routine same-shift
// closures are dropped here (they remain in /api/debug). "pending" is routed by substance —
// category + grounding completeness — not by the raw label (ADR 0010).

import { classifyThread, type ThreadClassification } from "@/lib/classify"
import {
  COMPLIANCE_CATEGORIES,
  MONEY_CATEGORIES,
  ROUTINE_CATEGORIES,
  SAFETY_CATEGORIES,
} from "@/lib/categories"
import { CATEGORY_LABEL } from "@/lib/labels"
import { logDecision } from "@/lib/logging"
import type { ShiftWindow } from "@/lib/shift"
import { unionEvidence } from "@/lib/threads"
import type {
  Category,
  DecisionRecord,
  EventFlag,
  Handover,
  HandoverItem,
  Hotel,
  IssueThread,
  NormalizedEvent,
} from "@/lib/types"

/** Flags that put an item in requires-verification (urgent is priority, not verification). */
const VERIFICATION_FLAGS: EventFlag[] = [
  "prompt_injection",
  "unconfirmed",
  "incomplete_evidence",
  "disputes_prior",
  "contradicts_system",
]

/** New-tonight categories that read as information, not an open action → FYI. */
const INFORMATIONAL_CATEGORIES = new Set<Category>([
  "guest_message",
  "incident",
  "note",
  "connectivity",
  "complaint",
  "finance",
])

export class GroundingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "GroundingError"
  }
}

export interface AssembleInput {
  hotel: Hotel
  window: ShiftWindow
  threads: IssueThread[]
  nightLogIngested: boolean
  droppedExtractions: number
}

export interface AssembleResult {
  handover: Handover
  decisions: DecisionRecord[]
}

function unionFlags(events: NormalizedEvent[]): EventFlag[] {
  const seen = new Set<EventFlag>()
  for (const e of events) for (const f of e.flags) seen.add(f)
  return [...seen]
}

function hasVerificationFlag(flags: EventFlag[]): boolean {
  return flags.some((f) => VERIFICATION_FLAGS.includes(f))
}

/** The actionable + notable predicate (ADR 0006). Routine same-shift closures drop out. */
function isNotable(thread: IssueThread, cls: ThreadClassification): boolean {
  const flags = unionFlags(cls.visibleEvents)
  if (cls.state === "contested") return true
  if (hasVerificationFlag(flags) || flags.includes("urgent")) return true
  // Carryover (still open) and wins (resolved tonight) are always worth surfacing.
  if (cls.classification === "still_open" || cls.classification === "resolved_tonight") return true

  if (cls.classification === "new_tonight") {
    const c = thread.category
    if (cls.state === "resolved") {
      // A same-shift close is notable only if it carries money/compliance/safety/finance.
      return (
        MONEY_CATEGORIES.has(c) ||
        COMPLIANCE_CATEGORIES.has(c) ||
        SAFETY_CATEGORIES.has(c) ||
        c === "guest_message"
      )
    }
    // An unresolved/pending new item is notable unless it's purely routine.
    return !ROUTINE_CATEGORIES.has(c)
  }

  return false
}

function titleFor(thread: IssueThread): string {
  const label = CATEGORY_LABEL[thread.category]
  if (thread.areaKeyed || !thread.room) return label
  return `Room ${thread.room} — ${label}`
}

function summaryFor(thread: IssueThread, cls: ThreadClassification): string {
  const visible = cls.visibleEvents

  // Injection: describe, never echo the body; never apply the demand (ADR 0007).
  const injected = visible.find((e) => e.flags.includes("prompt_injection"))
  if (injected) {
    const where = injected.room ? `room ${injected.room}` : "an unidentified source"
    return `A note from ${where} contained text imitating instructions to this tool (e.g. suppress the handover and apply a credit). Flagged and ignored — not applied. Needs manager review.`
  }

  // Contested: state the conflict plainly with both sides (ADR 0005); never pick a side.
  if (cls.state === "contested") {
    const lines = [...new Set(visible.map((e) => e.description.trim()))]
    return `Conflicting records — requires verification (do not auto-resolve): ${lines.join(" — vs — ")}`
  }

  // Default: the latest visible event's grounded description is the current picture.
  return visible[visible.length - 1].description.trim()
}

function buildItem(thread: IssueThread, cls: ThreadClassification): HandoverItem {
  const flags = unionFlags(cls.visibleEvents)
  return {
    threadId: thread.id,
    title: titleFor(thread),
    room: thread.room,
    category: thread.category,
    state: cls.state,
    classification: cls.classification,
    summary: summaryFor(thread, cls),
    // Only evidence for events visible at this window — no leaking future events.
    evidence: unionEvidence(cls.visibleEvents).map((e) => e.sourceId),
    flags,
  }
}

/** Assemble the curated handover plus the per-thread decision records (ADR 0011). */
export function assembleHandover(input: AssembleInput): AssembleResult {
  const { hotel, window: w } = input
  const handover: Handover = {
    hotel: { id: hotel.id, name: hotel.name },
    shiftDate: w.date,
    window: { from: w.from, to: w.to },
    stillOpen: [],
    newTonight: [],
    resolvedTonight: [],
    requiresVerification: [],
    fyi: [],
    warnings: [],
  }
  const decisions: DecisionRecord[] = []

  for (const thread of input.threads) {
    const cls = classifyThread(thread, w)

    // Decision record for every thread that informed this date (ADR 0011).
    const decision: DecisionRecord = {
      hotelId: hotel.id,
      shiftDate: w.date,
      issueId: thread.id,
      decision: cls.state === "contested" ? "contested" : cls.classification,
      reason: cls.reason,
      evidence: unionEvidence(cls.visibleEvents).map((e) => e.sourceId),
    }
    if (cls.classification !== "dormant") {
      decisions.push(decision)
      logDecision(decision)
    }

    if (cls.classification === "dormant" || !isNotable(thread, cls)) continue

    const item = buildItem(thread, cls)

    if (hasVerificationFlag(item.flags) || item.state === "contested") {
      handover.requiresVerification.push(item)
    }

    // Awareness-only items (incident/complaint/wifi/notes) read as FYI even when carried
    // over, unless they've turned actionable (contested or urgent) (ADR 0006 / 0010).
    const informational =
      INFORMATIONAL_CATEGORIES.has(item.category) &&
      item.state !== "contested" &&
      !item.flags.includes("urgent")

    if (item.classification === "resolved_tonight") {
      handover.resolvedTonight.push(item)
    } else if (item.classification === "still_open") {
      if (informational) handover.fyi.push(item)
      else handover.stillOpen.push(item)
    } else if (item.classification === "new_tonight") {
      if (informational || item.state === "resolved") handover.fyi.push(item)
      else handover.newTonight.push(item)
    }

    if (item.flags.includes("prompt_injection")) {
      const where = item.room ? `room ${item.room}` : "an unidentified source"
      handover.warnings.push(
        `Prompt injection flagged in ${where} (${item.evidence.join(", ")}); surfaced for review, never obeyed.`,
      )
    }
  }

  if (!input.nightLogIngested) {
    handover.warnings.push(
      "Night log not ingested (extraction unavailable); the free-text shift was omitted — manual review.",
    )
  }
  if (input.droppedExtractions > 0) {
    handover.warnings.push(
      `${input.droppedExtractions} night-log extraction(s) dropped for failing the grounding check.`,
    )
  }

  validateGrounding(handover, input.threads)
  return { handover, decisions }
}

/** Final pass: every cited id must resolve to a real source record, or fail closed (ADR 0004). */
export function validateGrounding(handover: Handover, threads: IssueThread[]): void {
  const known = new Set<string>()
  for (const t of threads) {
    for (const e of t.events) {
      known.add(e.id)
      for (const ev of e.evidence) known.add(ev.sourceId)
    }
  }
  const sections: HandoverItem[][] = [
    handover.stillOpen,
    handover.newTonight,
    handover.resolvedTonight,
    handover.requiresVerification,
    handover.fyi,
  ]
  for (const section of sections) {
    for (const item of section) {
      if (item.evidence.length === 0) {
        throw new GroundingError(`Item ${item.threadId} has no evidence — refusing to emit.`)
      }
      for (const id of item.evidence) {
        if (!known.has(id)) {
          throw new GroundingError(`Item ${item.threadId} cites unknown source ${id} — failing closed.`)
        }
      }
    }
  }
}
