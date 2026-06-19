// Structured decision logging (ADR 0011).
//
// One JSON line per thread classification to stdout (greppable in the platform log
// pipeline) carrying which hotel / night / issue / why. Records carry source ids only —
// never guest content or injection bodies (ADR 0007 / 0011).

import type { DecisionRecord } from "@/lib/types"

export function logDecision(record: DecisionRecord): void {
  // A single line so it survives log aggregation intact.
  console.log(JSON.stringify({ kind: "handover_decision", ...record }))
}
