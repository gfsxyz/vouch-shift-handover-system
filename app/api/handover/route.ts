// GET /api/handover?date=YYYY-MM-DD — the curl target (ADR 0008).
// Returns the curated, grounded handover JSON for a morning shift.

import { parseDate } from "@/lib/api"
import { GroundingError } from "@/lib/handover"
import { buildHandover } from "@/lib/pipeline"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const { date, error } = parseDate(request.url)
  if (error) return Response.json({ error }, { status: 400 })

  try {
    const { handover } = await buildHandover(date)
    return Response.json(handover)
  } catch (err) {
    if (err instanceof GroundingError) {
      // Fail closed: we refuse to ship an unsupported claim rather than guess.
      return Response.json({ error: "grounding_failed", detail: err.message }, { status: 502 })
    }
    const detail = err instanceof Error ? err.message : "unknown error"
    return Response.json({ error: "internal_error", detail }, { status: 500 })
  }
}
