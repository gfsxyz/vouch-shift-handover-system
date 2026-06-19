// Shift windowing — the single source of truth for "which shift" (ADR 0001).
//
// A night shift runs ~23:00–07:00 in the hotel timezone and crosses midnight, so a
// physical shift spans two calendar dates. `?date=D` means the morning the handover is
// for; the window is:
//
//     window(D) = [ (D-1) 23:00:00 , D 07:00:00 )   in the hotel offset
//
// This file is pure and deterministic and is unit-tested independently of everything else.

export interface ShiftWindow {
  /** The handover date `D` (`YYYY-MM-DD`). */
  date: string
  /** Inclusive start, ISO 8601 with offset. */
  from: string
  /** Exclusive end, ISO 8601 with offset. */
  to: string
  /** Epoch ms for `from` / `to` — the comparison keys. */
  fromMs: number
  toMs: number
  timezone: string
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TZ_RE = /^[+-]\d{2}:\d{2}$/

/** Return `YYYY-MM-DD` for the calendar day before `date`, via UTC arithmetic (DST-safe). */
export function previousDate(date: string): string {
  if (!DATE_RE.test(date)) throw new Error(`Invalid date: ${date} (expected YYYY-MM-DD)`)
  const [y, m, d] = date.split("-").map(Number)
  const prev = new Date(Date.UTC(y, m - 1, d) - 24 * 60 * 60 * 1000)
  return prev.toISOString().slice(0, 10)
}

/** Build the shift window for handover date `D` in the hotel `timezone` offset. */
export function shiftWindow(date: string, timezone: string): ShiftWindow {
  if (!DATE_RE.test(date)) throw new Error(`Invalid date: ${date} (expected YYYY-MM-DD)`)
  if (!TZ_RE.test(timezone)) throw new Error(`Invalid timezone offset: ${timezone}`)

  const from = `${previousDate(date)}T23:00:00${timezone}`
  const to = `${date}T07:00:00${timezone}`
  const fromMs = Date.parse(from)
  const toMs = Date.parse(to)
  if (Number.isNaN(fromMs) || Number.isNaN(toMs)) {
    throw new Error(`Could not parse window for date=${date} tz=${timezone}`)
  }
  return { date, from, to, fromMs, toMs, timezone }
}

/** Is an epoch-ms timestamp inside `[from, to)`? */
export function inWindow(ts: number, w: ShiftWindow): boolean {
  return ts >= w.fromMs && ts < w.toMs
}

/** Is an epoch-ms timestamp before this window's start (a "prior night")? */
export function beforeWindow(ts: number, w: ShiftWindow): boolean {
  return ts < w.fromMs
}

/** Is an epoch-ms timestamp known at handover time (before the window closes at 07:00)? */
export function visibleAt(ts: number, w: ShiftWindow): boolean {
  return ts < w.toMs
}

/** Format an epoch-ms instant as an ISO 8601 string in a fixed `+HH:MM` offset. */
export function toOffsetIso(ms: number, timezone: string): string {
  if (!TZ_RE.test(timezone)) throw new Error(`Invalid timezone offset: ${timezone}`)
  const sign = timezone[0] === "-" ? -1 : 1
  const offMin = sign * (Number(timezone.slice(1, 3)) * 60 + Number(timezone.slice(4, 6)))
  const local = new Date(ms + offMin * 60 * 1000)
  const base = local.toISOString().slice(0, 19) // YYYY-MM-DDTHH:mm:ss
  return `${base}${timezone}`
}
