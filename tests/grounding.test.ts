import { readFile } from "node:fs/promises"
import path from "node:path"

import { describe, expect, it } from "vitest"

import { GroundingError, validateGrounding } from "@/lib/handover"
import { isGrounded, loadNightLog } from "@/lib/loaders/nightlog"
import { buildHandover } from "@/lib/pipeline"
import type { Handover, IssueThread } from "@/lib/types"

const everyItem = (h: Handover) => [
  ...h.stillOpen,
  ...h.newTonight,
  ...h.resolvedTonight,
  ...h.requiresVerification,
  ...h.fyi,
]

describe("grounding guard — ADR 0004", () => {
  it("admits a real snippet and rejects a fabricated one", async () => {
    const log = await readFile(path.join(process.cwd(), "data", "night-logs.md"), "utf8")
    expect(isGrounded(log, "208 房的客人刚才下来说房间的保险箱打不开了")).toBe(true)
    expect(isGrounded(log, "guest requested a complimentary upgrade to the penthouse")).toBe(false)
  })

  it("admits all bundled night-log extractions (none dropped)", async () => {
    const load = await loadNightLog({ shiftDate: "2026-05-28", timezone: "+08:00" })
    expect(load.ingested).toBe(true)
    expect(load.dropped).toEqual([])
    expect(load.events.length).toBeGreaterThan(0)
  })

  it("degrades gracefully when the log file is missing", async () => {
    const load = await loadNightLog({
      filePath: "/tmp/does-not-exist-vouch.md",
      shiftDate: "2026-05-28",
      timezone: "+08:00",
    })
    expect(load.ingested).toBe(false)
    expect(load.events).toEqual([])
  })

  it("every emitted handover item carries resolvable evidence", async () => {
    for (const date of ["2026-05-28", "2026-05-29", "2026-05-30"]) {
      const { handover, debug } = await buildHandover(date)
      const known = new Set(debug.events.map((e) => e.id))
      for (const item of everyItem(handover)) {
        expect(item.evidence.length).toBeGreaterThan(0)
        for (const id of item.evidence) expect(known.has(id)).toBe(true)
      }
    }
  })

  it("fails closed when an item cites an unknown source", () => {
    const threads: IssueThread[] = [
      {
        id: "room-100::deposit",
        room: "100",
        category: "deposit",
        areaKeyed: false,
        events: [
          {
            id: "evt_x",
            source: "json",
            timestamp: "2026-05-30T00:00:00+08:00",
            ts: Date.parse("2026-05-30T00:00:00+08:00"),
            type: "deposit_issue",
            room: "100",
            category: "deposit",
            guest: null,
            description: "x",
            status: "unresolved",
            evidence: [{ sourceId: "evt_x", text: "x" }],
            flags: [],
          },
        ],
        evidence: [{ sourceId: "evt_x", text: "x" }],
      },
    ]
    const base: Handover = {
      hotel: { id: "h", name: "H" },
      shiftDate: "2026-05-30",
      window: { from: "x", to: "y" },
      stillOpen: [
        {
          threadId: "room-100::deposit",
          title: "t",
          room: "100",
          category: "deposit",
          state: "open",
          classification: "still_open",
          summary: "s",
          evidence: ["evt_9999"], // not a known source
          flags: [],
        },
      ],
      newTonight: [],
      resolvedTonight: [],
      requiresVerification: [],
      fyi: [],
      warnings: [],
    }
    expect(() => validateGrounding(base, threads)).toThrow(GroundingError)
  })

  it("fails closed when an item has no evidence at all", () => {
    const base: Handover = {
      hotel: { id: "h", name: "H" },
      shiftDate: "2026-05-30",
      window: { from: "x", to: "y" },
      stillOpen: [],
      newTonight: [],
      resolvedTonight: [],
      requiresVerification: [],
      fyi: [
        {
          threadId: "t",
          title: "t",
          room: null,
          category: "note",
          state: "open",
          classification: "new_tonight",
          summary: "s",
          evidence: [],
          flags: [],
        },
      ],
      warnings: [],
    }
    expect(() => validateGrounding(base, [])).toThrow(GroundingError)
  })
})
