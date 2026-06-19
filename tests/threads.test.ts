import { describe, expect, it } from "vitest"

import { loadEventsFile, normalizeJsonEvents } from "@/lib/loaders/events"
import { buildThreads } from "@/lib/threads"
import type { IssueThread } from "@/lib/types"

async function jsonThreads(): Promise<IssueThread[]> {
  const raw = await loadEventsFile()
  return buildThreads(normalizeJsonEvents(raw))
}

describe("issue threading by (room, category) — ADR 0002", () => {
  it("splits room 309 into two distinct threads", async () => {
    const threads = await jsonThreads()
    const r309 = threads.filter((t) => t.room === "309")
    const categories = r309.map((t) => t.category).sort()
    expect(categories).toEqual(["check_in_id", "deposit"])
    // The booking/ID issue and the deposit issue never collapse into one.
    const idThread = r309.find((t) => t.category === "check_in_id")!
    const depThread = r309.find((t) => t.category === "deposit")!
    expect(idThread.events.map((e) => e.id)).toEqual(["evt_0006"])
    expect(depThread.events.map((e) => e.id)).toContain("evt_0007")
    expect(depThread.events.map((e) => e.id)).toContain("evt_0014")
  })

  it("threads the immigration backlog as one area issue across rooms and nights", async () => {
    const threads = await jsonThreads()
    const immigration = threads.find((t) => t.id === "area::compliance")!
    expect(immigration.areaKeyed).toBe(true)
    expect(immigration.events.map((e) => e.id)).toEqual(["evt_0003", "evt_0009", "evt_0019"])
  })

  it("threads the corridor leak as one area facilities issue", async () => {
    const threads = await jsonThreads()
    const leak = threads.find((t) => t.id === "area::facilities")!
    expect(leak.events.map((e) => e.id)).toEqual(["evt_0008", "evt_0013"])
  })

  it("routes the 312 finance-note dispute onto the no-show thread (not its own)", async () => {
    const threads = await jsonThreads()
    const r312 = threads.filter((t) => t.room === "312")
    // evt_0010 (no_show) and evt_0012 (finance_note re: the no-show charge) share one thread.
    expect(r312.map((t) => t.category)).toEqual(["no_show"])
    expect(r312[0].events.map((e) => e.id)).toEqual(["evt_0010", "evt_0012"])
  })

  it("keeps the 230 deposit-waived finance note as its own room-keyed thread", async () => {
    const threads = await jsonThreads()
    const r230 = threads.filter((t) => t.room === "230")
    expect(r230.map((t) => t.category)).toEqual(["deposit"])
  })

  it("every thread accumulates de-duplicated evidence", async () => {
    const threads = await jsonThreads()
    for (const t of threads) {
      const ids = t.evidence.map((e) => e.sourceId)
      expect(new Set(ids).size).toBe(ids.length)
      expect(ids.length).toBeGreaterThan(0)
    }
  })
})
