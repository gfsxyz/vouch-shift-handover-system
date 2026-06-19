// Issue threading — group normalized events into threads by (room, category) (ADR 0002).
//
// Cross-source joining is purely deterministic: once a free-text line is a normalized event
// with a (room, category), it joins existing threads by the same key. The model never
// decides thread membership. Threads accumulate the evidence of their member events.

import { isAreaKeyed, threadKey } from "@/lib/categories"
import type { IssueThread, NormalizedEvent } from "@/lib/types"

/** Build issue threads from all normalized events (both sources), ordered by time. */
export function buildThreads(events: NormalizedEvent[]): IssueThread[] {
  const sorted = [...events].sort((a, b) => a.ts - b.ts || a.id.localeCompare(b.id))

  const byKey = new Map<string, IssueThread>()
  for (const e of sorted) {
    const id = threadKey(e.room, e.category)
    let thread = byKey.get(id)
    if (!thread) {
      thread = {
        id,
        // Area issues span many rooms; the specific rooms live in the event evidence.
        room: isAreaKeyed(e.category) ? null : e.room,
        category: e.category,
        areaKeyed: isAreaKeyed(e.category),
        events: [],
        evidence: [],
      }
      byKey.set(id, thread)
    }
    thread.events.push(e)
  }

  for (const thread of byKey.values()) {
    thread.evidence = unionEvidence(thread.events)
  }

  return [...byKey.values()].sort((a, b) => a.id.localeCompare(b.id))
}

/** Union of evidence across events, de-duplicated by sourceId, in first-seen order. */
export function unionEvidence(events: NormalizedEvent[]): IssueThread["evidence"] {
  const seen = new Set<string>()
  const out: IssueThread["evidence"] = []
  for (const e of events) {
    for (const ev of e.evidence) {
      if (!seen.has(ev.sourceId)) {
        seen.add(ev.sourceId)
        out.push(ev)
      }
    }
  }
  return out
}
