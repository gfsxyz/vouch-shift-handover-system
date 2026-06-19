// Free-text night-log loader — the only model-touched input (ADR 0003).
//
// Extracts normalized events (ADR 0009), then enforces grounding deterministically: an
// event is admitted only if its `sourceText` is a real substring of the log; un-anchorable
// extractions are dropped, not guessed (ADR 0004). Degrades gracefully if extraction is
// unavailable (ADR 0003 / 0008).

import { readFile } from "node:fs/promises"
import path from "node:path"

import { ExtractionUnavailableError, extractNightLog } from "@/lib/extraction/extract"
import type { ExtractedEvent } from "@/lib/extraction/schema"
import { toOffsetIso } from "@/lib/shift"
import type { EventFlag, NormalizedEvent } from "@/lib/types"

const DEFAULT_PATH = path.join(process.cwd(), "data", "night-logs.md")

export interface NightLogSource {
  filePath?: string
  /** The morning this shift's log belongs to (ADR 0001). Supplied, not parsed from prose. */
  shiftDate: string
  timezone: string
  headerHint?: string
}

export interface NightLogLoad {
  events: NormalizedEvent[]
  /** False when the model/key was unavailable and the log could not be normalized. */
  ingested: boolean
  /** Anchors of extractions dropped for failing the grounding (substring) check. */
  dropped: string[]
}

const normalizeWs = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase()

/** Grounding guard (ADR 0004): a snippet must really occur in the log to be admitted. */
export function isGrounded(logText: string, snippet: string): boolean {
  if (!snippet) return false
  return normalizeWs(logText).includes(normalizeWs(snippet))
}

const INJECTION_RE =
  /system note to the|ignore (all|other|previous)|report .*all clear|mark it approved|goodwill credit/

const pad = (n: number) => String(n).padStart(2, "0")

/** Read the night log and normalize it into grounded events. */
export async function loadNightLog(source: NightLogSource): Promise<NightLogLoad> {
  const filePath = source.filePath ?? DEFAULT_PATH
  let text: string
  try {
    text = await readFile(filePath, "utf8")
  } catch {
    return { events: [], ingested: false, dropped: [] }
  }

  let extracted: ExtractedEvent[]
  try {
    const result = await extractNightLog(text, source.headerHint ?? "")
    extracted = result.events
  } catch (err) {
    if (err instanceof ExtractionUnavailableError) {
      return { events: [], ingested: false, dropped: [] }
    }
    throw err
  }

  const haystack = normalizeWs(text)
  // Anchor extracted events deep in the shift so they sort after prior-night json events
  // and before the next night's. Exact intra-window time is immaterial to classification.
  const baseMs = Date.parse(`${source.shiftDate}T02:00:00${source.timezone}`)

  const events: NormalizedEvent[] = []
  const dropped: string[] = []

  extracted.forEach((ev, i) => {
    const anchor = `nightlog#${pad(i + 1)}`

    // Grounding guard: the snippet must really appear in the log (ADR 0004).
    if (!ev.sourceText || !haystack.includes(normalizeWs(ev.sourceText))) {
      dropped.push(anchor)
      return
    }

    const ts = baseMs + i * 60_000
    const flags: EventFlag[] = [...(ev.flags ?? [])]
    // Defense in depth: re-assert the injection flag from typed signals (ADR 0007).
    if (INJECTION_RE.test(ev.sourceText.toLowerCase()) && !flags.includes("prompt_injection")) {
      flags.push("prompt_injection")
    }

    events.push({
      id: anchor,
      source: "night_log",
      timestamp: toOffsetIso(ts, source.timezone),
      ts,
      type: "night_log",
      room: ev.room,
      category: ev.category,
      guest: ev.guest,
      description: ev.summary,
      status: ev.status,
      evidence: [{ sourceId: anchor, text: ev.sourceText }],
      flags,
    })
  })

  return { events, ingested: true, dropped }
}
