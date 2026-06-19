// GET /api/debug?date=YYYY-MM-DD — the full thread → event → evidence chain plus the
// per-thread decision records (ADR 0008, 0011). The on-demand twin of the stdout logs and
// the data behind the UI's evidence drawer.

import { parseDate } from "@/lib/api"
import { GroundingError } from "@/lib/handover"
import { buildHandover } from "@/lib/pipeline"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const { date, error } = parseDate(request.url)
  if (error) return Response.json({ error }, { status: 400 })

  try {
    const { handover, decisions, debug } = await buildHandover(date)
    return Response.json({ handover, decisions, ...debug })
  } catch (err) {
    if (err instanceof GroundingError) {
      return Response.json({ error: "grounding_failed", detail: err.message }, { status: 502 })
    }
    const detail = err instanceof Error ? err.message : "unknown error"
    return Response.json({ error: "internal_error", detail }, { status: 500 })
  }
}
