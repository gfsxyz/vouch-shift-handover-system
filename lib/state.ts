// Per-thread state derivation (ADR 0005).
//
// A thread's state comes from its ordered events. A later dispute or a cross-source
// contradiction NEVER silently flips state to resolved — the thread becomes `contested`
// and is escalated. Otherwise the latest event's status wins. Detection is deterministic
// and keys only on typed flags, never on free text (ADR 0007).

import type { NormalizedEvent, ThreadState } from "@/lib/types"

/** True if any event disputes a prior settlement or contradicts a structured record. */
export function isConflicted(events: NormalizedEvent[]): boolean {
  return events.some((e) => e.flags.includes("disputes_prior") || e.flags.includes("contradicts_system"))
}

/**
 * Derive thread state from a time-ordered slice of events (typically the events visible at
 * a shift window). Conflicts escalate to `contested`; otherwise the latest status wins.
 */
export function deriveState(eventsAsc: NormalizedEvent[]): ThreadState {
  if (eventsAsc.length === 0) return "open"
  if (isConflicted(eventsAsc)) return "contested"

  const latest = eventsAsc[eventsAsc.length - 1]
  if (latest.status === "resolved") return "resolved"
  if (latest.status === "pending") return "pending"
  return "open"
}
