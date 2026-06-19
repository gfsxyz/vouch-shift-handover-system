// Content-hash cache for night-log extraction (ADR 0008).
//
// Extraction is the one nondeterministic step; caching it by source content hash makes
// repeated handover requests byte-stable and avoids re-hitting the model. A changed night
// log invalidates by hash automatically.
//
// Lookup order: in-memory → committed seed (`seed/`) → runtime cache (`.cache/`). The seed
// directory holds a captured extraction for the bundled sample so the service runs without
// a live key; any unseen log misses the cache and goes to the model.

import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import type { ExtractionResult } from "@/lib/extraction/schema"

const SEED_DIR = path.join(process.cwd(), "lib", "extraction", "seed")
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
  const seed = await readJsonIfExists(path.join(SEED_DIR, `${hash}.json`))
  if (seed) {
    memory.set(hash, seed)
    return seed
  }
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
