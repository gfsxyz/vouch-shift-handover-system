// Structured event loader — parsed deterministically, no model (ADR 0003).
//
// Input arrives as data through a swappable loader so the service generalizes beyond the
// bundled sample (brief / ADR 0008). Every normalized event carries its evidence from the
// first line (ADR 0004).

import { readFile } from "node:fs/promises"
import path from "node:path"

import { categoryForJsonEvent, flagsForJsonEvent } from "@/lib/categories"
import type { Hotel, NormalizedEvent, RawStatus } from "@/lib/types"

interface RawEvent {
  id: string
  timestamp: string
  type: string
  room: string | null
  guest: string | null
  description: string
  status: RawStatus
}

export interface RawEventsFile {
  hotel: { id: string; name: string; rooms?: number; timezone: string }
  note?: string
  events: RawEvent[]
}

const DEFAULT_PATH = path.join(process.cwd(), "data", "events.json")

/** Read and parse the structured events file (default: bundled sample). */
export async function loadEventsFile(filePath: string = DEFAULT_PATH): Promise<RawEventsFile> {
  const text = await readFile(filePath, "utf8")
  return JSON.parse(text) as RawEventsFile
}

export function hotelFromRaw(raw: RawEventsFile): Hotel {
  return { id: raw.hotel.id, name: raw.hotel.name, timezone: raw.hotel.timezone }
}

/** Turn raw json events into normalized events. Pure and deterministic. */
export function normalizeJsonEvents(raw: RawEventsFile): NormalizedEvent[] {
  return raw.events.map((e) => {
    const category = categoryForJsonEvent(e.type, e.description)
    const flags = flagsForJsonEvent(e.type, e.description)
    return {
      id: e.id,
      source: "json",
      timestamp: e.timestamp,
      ts: Date.parse(e.timestamp),
      type: e.type,
      room: e.room,
      category,
      guest: e.guest,
      description: e.description,
      status: e.status,
      evidence: [{ sourceId: e.id, text: e.description }],
      flags,
    }
  })
}
