// Content-hash cache for night-log extraction (ADR 0008).
//
// Extraction is the one nondeterministic step; caching it by source content hash makes
// repeated handover requests byte-stable and avoids re-hitting the model. A changed night
// log invalidates by hash automatically.
//
// The cache ONLY ever holds outputs of a real model execution: lookup is in-memory →
// runtime `.cache/`, and `.cache/` is written exclusively by `putCached` after a live
// `generateObject` call. There is no committed/pre-baked extraction — the bundled sample is
// processed by the model exactly like any unseen log.

import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import type { ExtractionResult } from "@/lib/extraction/schema"

const RUNTIME_DIR = path.join(process.cwd(), ".cache", "extraction")

const memory = new Map<string, ExtractionResult>()

export function hashContent(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex").slice(0, 16)
}

async function readJsonIfExists(file: string): Promise<ExtractionResult | null> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as ExtractionResult
  } catch {
    return null
  }
}

export async function getCached(hash: string): Promise<ExtractionResult | null> {
  if (memory.has(hash)) return memory.get(hash)!
  const runtime = await readJsonIfExists(path.join(RUNTIME_DIR, `${hash}.json`))
  if (runtime) {
    memory.set(hash, runtime)
    return runtime
  }
  return null
}

export async function putCached(hash: string, result: ExtractionResult): Promise<void> {
  memory.set(hash, result)
  try {
    await mkdir(RUNTIME_DIR, { recursive: true })
    await writeFile(path.join(RUNTIME_DIR, `${hash}.json`), JSON.stringify(result, null, 2), "utf8")
  } catch {
    // Serverless filesystems can be read-only; the in-memory cache still holds for the
    // life of the process. Reproducibility within a deploy is unaffected.
  }
}

/**
 * Seed the in-memory cache directly (no disk write). For tests only — they prime a fixture
 * that was *recorded from a real model run* so the suite stays offline and deterministic
 * without the production path ever consulting a committed extraction.
 */
export function primeMemoryCache(hash: string, result: ExtractionResult): void {
  memory.set(hash, result)
}
