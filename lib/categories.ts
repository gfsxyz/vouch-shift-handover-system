// Category normalization + thread-key rules (ADR 0002).
//
// Threads are identified by (room, normalized category). This module owns the controlled
// vocabulary and the deterministic rules that:
//   - map raw json `type` values onto categories,
//   - decide which categories are AREA-keyed (category-only, room ignored),
//   - flag dispute / injection signals from typed json fields.
//
// Free-text events get their category from the model (ADR 0003), but from the SAME
// vocabulary, so cross-source threads join by the same key. The map lives in code and is
// documented here on purpose (ADR 0002 "Consequences").

import type { Category, EventFlag } from "@/lib/types"

/** The controlled category vocabulary the model is also constrained to. */
export const CATEGORIES: Category[] = [
  "maintenance",
  "facilities",
  "compliance",
  "deposit",
  "no_show",
  "damage",
  "complaint",
  "check_in_id",
  "occupancy",
  "incident",
  "safe_box",
  "early_checkout",
  "guest_message",
  "connectivity",
  "keycard",
  "walk_in",
  "finance",
  "note",
]

/**
 * AREA-keyed categories: one thread per category regardless of room (ADR 0002).
 * - `compliance` — the immigration-reporting backlog spans many rooms / null rooms.
 * - `facilities` — the corridor leak is a common-area issue.
 * - `walk_in` — never room-bound.
 */
export const AREA_KEYED = new Set<Category>(["compliance", "facilities", "walk_in"])

/** Routine categories that, when opened-and-closed in one shift, are noise (ADR 0006). */
export const ROUTINE_CATEGORIES = new Set<Category>(["occupancy", "keycard", "walk_in", "note"])

/** Money-bearing categories (notable predicate, ADR 0006 / 0010). */
export const MONEY_CATEGORIES = new Set<Category>(["deposit", "no_show", "damage", "early_checkout", "finance"])

/** Compliance / identity categories (notable predicate). */
export const COMPLIANCE_CATEGORIES = new Set<Category>(["compliance", "check_in_id"])

/** Safety / welfare categories (notable predicate). */
export const SAFETY_CATEGORIES = new Set<Category>(["incident", "safe_box"])

/** Direct json `type` → category map. `finance_note` is content-routed (see below). */
const TYPE_TO_CATEGORY: Record<string, Category> = {
  check_in: "occupancy",
  check_in_issue: "check_in_id",
  deposit_issue: "deposit",
  maintenance: "maintenance",
  compliance: "compliance",
  complaint: "complaint",
  lost_keycard: "keycard",
  facilities: "facilities",
  no_show: "no_show",
  incident: "incident",
  early_checkout_request: "early_checkout",
  damage_report: "damage",
  guest_message: "guest_message",
  note: "note",
  walk_in: "walk_in",
}

/**
 * A `finance_note` is a follow-up note, not its own issue type — route it to the thread it
 * is *about* so e.g. the 312 no-show dispute (evt_0012) lands on the 312 no-show thread
 * (ADR 0005). This is deterministic classification of a typed field, not obeying content.
 */
function categorizeFinanceNote(description: string): Category {
  const d = description.toLowerCase()
  if (/no[-\s]?show/.test(d)) return "no_show"
  if (/deposit/.test(d)) return "deposit"
  return "finance"
}

/** Normalize a json event's category from its `type` (+ description for finance notes). */
export function categoryForJsonEvent(type: string, description: string): Category {
  if (type === "finance_note") return categorizeFinanceNote(description)
  const mapped = TYPE_TO_CATEGORY[type]
  if (mapped) return mapped
  // Unknown type → keep it visible as a generic note rather than guessing.
  return "note"
}

/**
 * Deterministic flags derived from a json event's typed fields (never from free-text
 * instructions). Detection is best-effort labelling; safety does not depend on it (ADR 0007).
 */
export function flagsForJsonEvent(type: string, description: string): EventFlag[] {
  const flags: EventFlag[] = []
  const d = description.toLowerCase()

  // Prompt-injection heuristic (ADR 0007): label only — code never branches on content.
  if (
    /system note to the|ignore (all|other|previous)|report .*all clear|mark it approved|goodwill credit/.test(d)
  ) {
    flags.push("prompt_injection")
  }

  // A finance note that disputes a prior charge → contested thread (ADR 0005).
  if (type === "finance_note" && /disput|claims (he|she)|cancellation window|reverse|investigat/.test(d)) {
    flags.push("disputes_prior")
  }

  // A money proposal without the backing it needs (e.g. damage fee, no photos/approval).
  if (/no photos|no manager approval|not yet|no approval on record|proposes charging/.test(d)) {
    flags.push("incomplete_evidence")
  }

  return flags
}

/** Stable thread key for a (room, category) pair (ADR 0002). */
export function threadKey(room: string | null, category: Category): string {
  if (AREA_KEYED.has(category)) return `area::${category}`
  return `room-${room ?? "none"}::${category}`
}

/** Whether a category is area-keyed (room ignored when threading). */
export function isAreaKeyed(category: Category): boolean {
  return AREA_KEYED.has(category)
}
