// Small shared helpers for the API route handlers.

/** Latest full shift in the bundled sample — used when no ?date is supplied. */
export const DEFAULT_DATE = "2026-05-30"

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export interface ParsedDate {
  date: string
  error?: string
}

/** True only for a real calendar date in `YYYY-MM-DD` form (rejects 2026-13-99, 2026-02-30). */
export function isValidDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false
  const [y, m, d] = s.split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

/** Read and validate `?date=YYYY-MM-DD`, defaulting to the latest sample shift. */
export function parseDate(url: string): ParsedDate {
  const param = new URL(url).searchParams.get("date")
  if (param === null) return { date: DEFAULT_DATE }
  if (!isValidDate(param)) {
    return { date: param, error: `Invalid date '${param}'. Expected a real YYYY-MM-DD.` }
  }
  return { date: param }
}
