import { describe, expect, it } from "vitest"

import { buildHandover } from "@/lib/pipeline"
import type { Handover, HandoverItem } from "@/lib/types"

const lifecycle = (h: Handover): HandoverItem[] => [
  ...h.stillOpen,
  ...h.newTonight,
  ...h.resolvedTonight,
  ...h.fyi,
]
const inVerification = (h: Handover, id: string) => h.requiresVerification.some((i) => i.threadId === id)
const find = (h: Handover, id: string) => lifecycle(h).find((i) => i.threadId === id)

describe("reconciliation across nights — ADR 0005", () => {
  it("312 no-show is resolved tonight on 28, then contested once disputed on 29", async () => {
    const d28 = (await buildHandover("2026-05-28")).handover
    const on28 = d28.resolvedTonight.find((i) => i.threadId === "room-312::no_show")
    expect(on28).toBeTruthy()
    expect(on28!.state).toBe("resolved")
    expect(inVerification(d28, "room-312::no_show")).toBe(false)

    const d29 = (await buildHandover("2026-05-29")).handover
    const on29 = find(d29, "room-312::no_show")!
    expect(on29.classification).toBe("still_open")
    expect(on29.state).toBe("contested")
    expect(inVerification(d29, "room-312::no_show")).toBe(true)
    // The dispute event is now part of the picture.
    expect(on29.evidence).toContain("evt_0012")
    // Never auto-settled: the summary states the conflict, not a verdict.
    expect(on29.summary.toLowerCase()).toContain("requires verification")
  })

  it("205 occupancy is contested (system in-house vs rounds found it vacated)", async () => {
    const h = (await buildHandover("2026-05-28")).handover
    const item = find(h, "room-205::occupancy")!
    expect(item.state).toBe("contested")
    expect(inVerification(h, "room-205::occupancy")).toBe(true)
    expect(item.evidence).toEqual(expect.arrayContaining(["evt_0024", "nightlog#07"]))
  })

  it("112 aircon reconciles across json + night log + json (all nights)", async () => {
    const h = (await buildHandover("2026-05-30")).handover
    const item = find(h, "room-112::maintenance")!
    expect(item.classification).toBe("still_open")
    expect(item.evidence).toEqual(expect.arrayContaining(["evt_0002", "nightlog#02", "evt_0018"]))
  })

  it("date=2026-05-30 maps to the 29→30 shift window", async () => {
    const h = (await buildHandover("2026-05-30")).handover
    expect(h.window.from).toBe("2026-05-29T23:00:00+08:00")
    expect(h.window.to).toBe("2026-05-30T07:00:00+08:00")
  })

  it("309 surfaces as two separate items", async () => {
    const h = (await buildHandover("2026-05-30")).handover
    const items = lifecycle(h).filter((i) => i.room === "309")
    expect(items.map((i) => i.category).sort()).toEqual(["check_in_id", "deposit"])
  })
})
