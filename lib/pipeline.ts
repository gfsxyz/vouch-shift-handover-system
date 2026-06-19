// Top-level pipeline: events.json + night-log → threads → classify @ window → handover.
//
// Deterministic except the one cached extraction step. In-memory, no DB (ADR 0008). The
// core (buildFromEvents) is pure and unit-testable; buildHandover wires in the file loaders.

import { classifyThread } from "@/lib/classify"
import { assembleHandover } from "@/lib/handover"
import { hotelFromRaw, loadEventsFile, normalizeJsonEvents } from "@/lib/loaders/events"
import { loadNightLog } from "@/lib/loaders/nightlog"
import { shiftWindow } from "@/lib/shift"
import { buildThreads } from "@/lib/threads"
import type {
  Classification,
  DecisionRecord,
  Evidence,
  Handover,
  Hotel,
  NormalizedEvent,
  ThreadState,
} from "@/lib/types"

/** The bundled free-text log belongs to the morning of 28 May (ADR 0001). */
export const NIGHT_LOG_SHIFT_DATE = "2026-05-28"

export interface DebugThread {
  id: string
  room: string | null
  category: string
  areaKeyed: boolean
  classification: Classification
  state: ThreadState
  reason: string
  events: NormalizedEvent[]
  evidence: Evidence[]
}

export interface BuildResult {
  handover: Handover
  decisions: DecisionRecord[]
  debug: {
    hotel: Hotel
    window: { from: string; to: string; date: string }
    nightLog: { ingested: boolean; dropped: string[] }
    threads: DebugThread[]
    events: NormalizedEvent[]
  }
}

export interface BuildMeta {
  nightLogIngested: boolean
  droppedExtractions: string[]
}

/** Pure core: assemble a handover for `date` from already-normalized events. */
export function buildFromEvents(
  events: NormalizedEvent[],
  hotel: Hotel,
  date: string,
  meta: BuildMeta = { nightLogIngested: true, droppedExtractions: [] },
): BuildResult {
  const window = shiftWindow(date, hotel.timezone)
  const threads = buildThreads(events)

  const { handover, decisions } = assembleHandover({
    hotel,
    window,
    threads,
    nightLogIngested: meta.nightLogIngested,
    droppedExtractions: meta.droppedExtractions.length,
  })

  const debugThreads: DebugThread[] = threads.map((t) => {
    const cls = classifyThread(t, window)
    return {
      id: t.id,
      room: t.room,
      category: t.category,
      areaKeyed: t.areaKeyed,
      classification: cls.classification,
      state: cls.state,
      reason: cls.reason,
      events: t.events,
      evidence: t.evidence,
    }
  })

  return {
    handover,
    decisions,
    debug: {
      hotel,
      window: { from: window.from, to: window.to, date: window.date },
      nightLog: { ingested: meta.nightLogIngested, dropped: meta.droppedExtractions },
      threads: debugThreads,
      events: [...events].sort((a, b) => a.ts - b.ts || a.id.localeCompare(b.id)),
    },
  }
}

export interface BuildOptions {
  eventsPath?: string
  nightLogPath?: string
  nightLogShiftDate?: string
}

/** Load both sources from disk and build the handover for `date`. */
export async function buildHandover(date: string, options: BuildOptions = {}): Promise<BuildResult> {
  const raw = await loadEventsFile(options.eventsPath)
  const hotel = hotelFromRaw(raw)
  const jsonEvents = normalizeJsonEvents(raw)

  const nightLog = await loadNightLog({
    filePath: options.nightLogPath,
    shiftDate: options.nightLogShiftDate ?? NIGHT_LOG_SHIFT_DATE,
    timezone: hotel.timezone,
    headerHint: "night of 27 May → morning 28 May",
  })

  const events = [...jsonEvents, ...nightLog.events]
  return buildFromEvents(events, hotel, date, {
    nightLogIngested: nightLog.ingested,
    droppedExtractions: nightLog.dropped,
  })
}
