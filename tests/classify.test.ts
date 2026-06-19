import { describe, expect, it } from "vitest"

import { classifyThread } from "@/lib/classify"
import { loadEventsFile, normalizeJsonEvents } from "@/lib/loaders/events"
import { shiftWindow } from "@/lib/shift"
import { buildThreads } from "@/lib/threads"
import type { IssueThread } from "@/lib/types"

const TZ = "+08:00"
async function jsonThreads(): Promise<IssueThread[]> {
  const raw = await loadEventsFile()
  return buildThreads(normalizeJsonEvents(raw))
}

describe("classification at the shift window — ADR 0001/0002", () => {
  it("corridor leak is 'resolved tonight' for date=2026-05-29", async () => {
    const leak = (await jsonThreads()).find((t) => t.id === "area::facilities")!
    const cls = classifyThread(leak, shiftWindow("2026-05-29", TZ))
    expect(cls.classification).toBe("resolved_tonight")
    expect(cls.state).toBe("resolved")
  })

  it("corridor leak is 'dormant' (already resolved) for date=2026-05-30", async () => {
    const leak = (await jsonThreads()).find((t) => t.id === "area::facilities")!
    const cls = classifyThread(leak, shiftWindow("2026-05-30", TZ))
    expect(cls.classification).toBe("dormant")
  })

  it("room 112 aircon is 'still open' for date=2026-05-30 (carried across nights)", async () => {
    const aircon = (await jsonThreads()).find((t) => t.id === "room-112::maintenance")!
    const cls = classifyThread(aircon, shiftWindow("2026-05-30", TZ))
    expect(cls.classification).toBe("still_open")
    // evt_0018 (2026-05-29T23:40) is attributed to the 29→30 shift.
    expect(cls.inWindowEvents.map((e) => e.id)).toContain("evt_0018")
  })

  it("a boundary check-in at 23:40 belongs to the next morning's window", async () => {
    // evt_0018 at 2026-05-29T23:40 must be in window(2026-05-30), not window(2026-05-29).
    const aircon = (await jsonThreads()).find((t) => t.id === "room-112::maintenance")!
    const w29 = classifyThread(aircon, shiftWindow("2026-05-29", TZ))
    expect(w29.inWindowEvents.map((e) => e.id)).not.toContain("evt_0018")
  })

  it("does not leak future events into an earlier handover's evidence", async () => {
    const deposit309 = (await jsonThreads()).find((t) => t.id === "room-309::deposit")!
    const cls = classifyThread(deposit309, shiftWindow("2026-05-27", TZ))
    // evt_0014 (2026-05-30) must not be visible for a 2026-05-27 handover.
    expect(cls.visibleEvents.map((e) => e.id)).not.toContain("evt_0014")
  })
})
