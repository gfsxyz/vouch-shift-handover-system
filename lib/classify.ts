// Cross-night classification at a shift window (ADR 0001, 0002, 0005).
//
// The engine builds full thread history first, then slices each thread at window(D):
//   - resolved_tonight — was open before tonight, resolved during the shift (a win)
//   - new_tonight      — first appeared within this shift
//   - still_open       — carried over from a prior night, unresolved at window close
//   - dormant          — not surfaced at this window (e.g. already resolved earlier)
// Only events visible at handover time (before 07:00) inform the decision.

import { beforeWindow, inWindow, visibleAt, type ShiftWindow } from "@/lib/shift"
import { deriveState } from "@/lib/state"
import type { Classification, IssueThread, NormalizedEvent, ThreadState } from "@/lib/types"

export interface ThreadClassification {
  classification: Classification
  state: ThreadState
  /** Events known at handover time (ts < window.to), ascending. */
  visibleEvents: NormalizedEvent[]
  /** Subset that occurred within the window. */
  inWindowEvents: NormalizedEvent[]
  /** Human-readable rationale for the decision logs (ADR 0011). */
  reason: string
}

export function classifyThread(thread: IssueThread, w: ShiftWindow): ThreadClassification {
  const visible = thread.events.filter((e) => visibleAt(e.ts, w))
  if (visible.length === 0) {
    return {
      classification: "dormant",
      state: "open",
      visibleEvents: [],
      inWindowEvents: [],
      reason: "no events visible at this shift window",
    }
  }

  const before = visible.filter((e) => beforeWindow(e.ts, w))
  const inWin = visible.filter((e) => inWindow(e.ts, w))
  const state = deriveState(visible)
  const openedBefore = before.length > 0
  const latest = visible[visible.length - 1]

  const mk = (classification: Classification, reason: string): ThreadClassification => ({
    classification,
    state,
    visibleEvents: visible,
    inWindowEvents: inWin,
    reason,
  })

  if (state === "resolved") {
    const resolvedInWindow = inWindow(latest.ts, w)
    if (resolvedInWindow && openedBefore) {
      return mk("resolved_tonight", "was open before this shift; resolved during it")
    }
    if (resolvedInWindow && !openedBefore) {
      return mk("new_tonight", "opened and resolved within this shift")
    }
    return mk("dormant", "already resolved before this shift")
  }

  // open / pending / contested
  if (openedBefore) {
    return mk("still_open", `carried over from a prior night; ${state} at window close`)
  }
  return mk("new_tonight", `first seen this shift; ${state}`)
}
