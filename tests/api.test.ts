import { describe, expect, it } from "vitest"

import { DEFAULT_DATE, isValidDate, parseDate } from "@/lib/api"

describe("api date parsing", () => {
  it("accepts real dates and rejects impossible ones", () => {
    expect(isValidDate("2026-05-30")).toBe(true)
    expect(isValidDate("2026-13-99")).toBe(false)
    expect(isValidDate("2026-02-30")).toBe(false)
    expect(isValidDate("not-a-date")).toBe(false)
  })

  it("defaults to the latest sample shift when no date is given", () => {
    expect(parseDate("http://x/api/handover")).toEqual({ date: DEFAULT_DATE })
  })

  it("surfaces a validation error for a bad date param", () => {
    const r = parseDate("http://x/api/handover?date=2026-99-99")
    expect(r.error).toBeTruthy()
  })

  it("passes through a valid date param", () => {
    expect(parseDate("http://x/api/handover?date=2026-05-28")).toEqual({ date: "2026-05-28" })
  })
})
