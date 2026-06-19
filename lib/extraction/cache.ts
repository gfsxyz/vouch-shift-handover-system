// Content-hash cache for night-log extraction (ADR 0008).
//
// Extraction is the one nondeterministic step, but it is pinned at temperature 0, so for a
// given log the output never changes — re-calling the model on every request is pure waste
// (and, on stateless serverless, pure cost). Caching it by content hash makes handovers
// byte-stable and avoids re-billing.
//
// Lookup order, each a real model output:
//   1. in-memory     — reuse within a warm function instance.
//   2. recorded/      — committed, content-addressed recordings of REAL Sonnet runs. These
//                       ship inside the deployment bundle (read-only but readable), so a
//                       known log is a cache hit on every cold start — no model call. This is
//                       what makes the cost survive Vercel's statelessness.
//   3. runtime .cache/ — written after a live call where the filesystem is writable (local
//                       dev). On read-only serverless this stays empty; the in-memory layer
//                       still holds for the instance's lifetime.
// A log whose content hash is in none of these (an UNSEEN log) is extracted live, then
// memoized for the instance.

import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import type { ExtractionResult } from "@/lib/extraction/schema"

const RECORDED_DIR = path.join(process.cwd(), "lib", "extraction", "recorded")
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

  const recorded = await readJsonIfExists(path.join(RECORDED_DIR, `${hash}.json`))
  if (recorded) {
    memory.set(hash, recorded)
    return recorded
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
    // Serverless filesystems are read-only; the in-memory cache still holds for the life of
    // the process. To make a NEW log free on cold starts, record it under recorded/ (see
    // README "Re-recording the extraction").
  }
}
