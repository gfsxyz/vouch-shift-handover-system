// Minimal handover view (ADR 0008). Server-rendered: it calls the pipeline directly and
// renders the JSON sections with a native <details> "evidence drawer" per item — the
// human-facing twin of /api/debug. Utility over polish, per the brief.

import Link from "next/link"

import { DEFAULT_DATE, isValidDate } from "@/lib/api"
import { buildHandover } from "@/lib/pipeline"
import type { Category, EventFlag, HandoverItem } from "@/lib/types"

export const dynamic = "force-dynamic"

const SAMPLE_DATES = ["2026-05-28", "2026-05-29", "2026-05-30"]

const FLAG_LABEL: Record<EventFlag, string> = {
  prompt_injection: "injection — ignored",
  unconfirmed: "unconfirmed",
  incomplete_evidence: "incomplete evidence",
  disputes_prior: "disputed",
  contradicts_system: "contradicts system",
  urgent: "urgent",
}

const DANGER_FLAGS = new Set<EventFlag>(["prompt_injection", "contradicts_system", "disputes_prior", "urgent"])

function Badge({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "warn" | "danger" | "ok" }) {
  const tones = {
    muted: "bg-muted text-muted-foreground",
    warn: "bg-chart-4/30 text-foreground",
    danger: "bg-destructive/15 text-destructive",
    ok: "bg-chart-1/20 text-foreground",
  }
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[0.65rem] font-medium ${tones[tone]}`}>
      {children}
    </span>
  )
}

function Item({ item, evidence }: { item: HandoverItem; evidence: Map<string, string> }) {
  return (
    <details className="group rounded-md border bg-card px-3 py-2">
      <summary className="flex cursor-pointer list-none flex-col gap-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-medium">{item.title}</span>
          <Badge tone={item.state === "contested" ? "danger" : "muted"}>{item.state}</Badge>
          {item.flags.map((f) => (
            <Badge key={f} tone={DANGER_FLAGS.has(f) ? "danger" : "warn"}>
              {FLAG_LABEL[f]}
            </Badge>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">{item.summary}</p>
      </summary>
      <div className="mt-2 border-t pt-2">
        <div className="mb-1 text-[0.65rem] font-semibold tracking-wide text-muted-foreground uppercase">
          Evidence
        </div>
        <ul className="flex flex-col gap-1">
          {item.evidence.map((id) => (
            <li key={id} className="text-xs">
              <span className="font-mono text-muted-foreground">{id}</span>
              <span className="ml-2">{evidence.get(id) ?? "(source)"}</span>
            </li>
          ))}
        </ul>
      </div>
    </details>
  )
}

function Section({
  title,
  hint,
  items,
  evidence,
  tone = "muted",
}: {
  title: string
  hint: string
  items: HandoverItem[]
  evidence: Map<string, string>
  tone?: "muted" | "warn" | "danger" | "ok"
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        <Badge tone={tone}>{items.length}</Badge>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">none</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {items.map((i) => (
            <Item key={i.threadId + i.classification} item={i} evidence={evidence} />
          ))}
        </div>
      )}
    </section>
  )
}

export default async function Page({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const sp = await searchParams
  const date = sp.date && isValidDate(sp.date) ? sp.date : DEFAULT_DATE
  const { handover: h, debug } = await buildHandover(date)

  const evidence = new Map<string, string>()
  for (const e of debug.events) for (const ev of e.evidence) evidence.set(ev.sourceId, ev.text)

  return (
    <main className="mx-auto flex min-h-svh max-w-3xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-lg font-semibold">
            {h.hotel.name} — morning handover
          </h1>
          <nav className="flex gap-1">
            {SAMPLE_DATES.map((d) => (
              <Link
                key={d}
                href={`/?date=${d}`}
                className={`rounded px-2 py-1 text-xs ${d === h.shiftDate ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-secondary"}`}
              >
                {d}
              </Link>
            ))}
          </nav>
        </div>
        <p className="text-xs text-muted-foreground">
          Shift {h.window.from} → {h.window.to}. Reconciled across nights; every line traces to source
          evidence. <Link className="underline" href={`/api/handover?date=${h.shiftDate}`}>JSON</Link>{" · "}
          <Link className="underline" href={`/api/debug?date=${h.shiftDate}`}>debug</Link>
        </p>
        {h.warnings.length > 0 && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
            {h.warnings.map((w, i) => (
              <div key={i}>⚠ {w}</div>
            ))}
          </div>
        )}
      </header>

      <Section
        title="Requires verification / action"
        hint="contradictions, disputes, incomplete or injected — never auto-resolved"
        items={h.requiresVerification}
        evidence={evidence}
        tone="danger"
      />
      <Section
        title="Still open"
        hint="carried over from a prior night, unresolved"
        items={h.stillOpen}
        evidence={evidence}
        tone="warn"
      />
      <Section title="New tonight" hint="first seen on this shift" items={h.newTonight} evidence={evidence} tone="warn" />
      <Section
        title="Resolved tonight"
        hint="was open before tonight, closed during the shift"
        items={h.resolvedTonight}
        evidence={evidence}
        tone="ok"
      />
      <Section title="FYI" hint="notable but not an open action" items={h.fyi} evidence={evidence} tone="muted" />

      <footer className="mt-auto border-t pt-3 text-[0.65rem] text-muted-foreground">
        Items can appear in two lists — verification is a cross-cutting flag, not a lifecycle stage. Routine
        same-shift closures are omitted here and live in <span className="font-mono">/api/debug</span>.
      </footer>
    </main>
  )
}
