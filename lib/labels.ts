import type { Category } from "@/lib/types"

/** Human labels for categories, used in handover item titles. */
export const CATEGORY_LABEL: Record<Category, string> = {
  maintenance: "Maintenance",
  facilities: "Facilities / common area",
  compliance: "Immigration reporting",
  deposit: "Deposit",
  no_show: "No-show charge",
  damage: "Damage",
  complaint: "Complaint",
  check_in_id: "Booking / ID check",
  occupancy: "Occupancy",
  incident: "Guest welfare",
  safe_box: "In-room safe",
  early_checkout: "Early checkout",
  guest_message: "Guest note",
  connectivity: "Connectivity / wifi",
  keycard: "Keycard",
  walk_in: "Walk-in",
  finance: "Finance note",
  note: "Front-desk note",
}
