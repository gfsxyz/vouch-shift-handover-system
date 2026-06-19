import { describe, expect, it } from "vitest"

import { beforeWindow, inWindow, previousDate, shiftWindow, visibleAt } from "@/lib/shift"

const TZ = "+08:00"
const ms = (iso: string) => Date.parse(iso)

describe("previousDate", () => {
  it("rolls back one calendar day", () => {
    expect(previousDate("2026-05-30")).toBe("2026-05-29")
  })
  it("crosses month boundaries", () => {
    expect(previousDate("2026-06-01")).toBe("2026-05-31")
  })
  it("crosses year boundaries", () => {
    expect(previousDate("2026-01-01")).toBe("2025-12-31")
  })
})

describe("shiftWindow", () => {
  it("spans (D-1) 23:00 to D 07:00 in the hotel offset", () => {
    const w = shiftWindow("2026-05-30", TZ)
    expect(w.from).toBe("2026-05-29T23:00:00+08:00")
    expect(w.to).toBe("2026-05-30T07:00:00+08:00")
  })
  it("rejects a malformed date", () => {
    expect(() => shiftWindow("2026-5-1", TZ)).toThrow()
  })
})

describe("inWindow — the worked example from CLAUDE.md", () => {
  // The corridor leak resolves at evt_0013 = 2026-05-29T00:10.
  const leakResolved = ms("2026-05-29T00:10:00+08:00")

  it("is 'in tonight' for date=2026-05-29", () => {
    expect(inWindow(leakResolved, shiftWindow("2026-05-29", TZ))).toBe(true)
  })

  it("is already-resolved (before window) for date=2026-05-30", () => {
    const w30 = shiftWindow("2026-05-30", TZ)
    expect(inWindow(leakResolved, w30)).toBe(false)
    expect(beforeWindow(leakResolved, w30)).toBe(true)
  })
})

describe("inWindow — cross-midnight boundary events", () => {
  it("attributes a 23:40 event to the upcoming morning, not the previous one", () => {
    // evt_0018 at 2026-05-29T23:40 belongs to window(2026-05-30).
    const evt = ms("2026-05-29T23:40:00+08:00")
    expect(inWindow(evt, shiftWindow("2026-05-30", TZ))).toBe(true)
    expect(inWindow(evt, shiftWindow("2026-05-29", TZ))).toBe(false)
  })

  it("treats 23:00:00 as inclusive and 07:00:00 as exclusive", () => {
    const w = shiftWindow("2026-05-30", TZ)
    expect(inWindow(ms("2026-05-29T23:00:00+08:00"), w)).toBe(true)
    expect(inWindow(ms("2026-05-30T07:00:00+08:00"), w)).toBe(false)
    expect(inWindow(ms("2026-05-30T06:59:59+08:00"), w)).toBe(true)
  })
})

describe("visibleAt — events after 07:00 are not yet known", () => {
  it("hides a future event from an earlier handover", () => {
    const future = ms("2026-05-30T08:00:00+08:00")
    expect(visibleAt(future, shiftWindow("2026-05-30", TZ))).toBe(false)
  })
})
