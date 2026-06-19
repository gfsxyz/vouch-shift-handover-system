// Test setup: prime the extraction cache with a fixture RECORDED FROM A REAL Sonnet 4.6 run
// (tests/fixtures/nightlog-extraction.json), so the suite is offline and deterministic
// without the production code ever consulting a committed extraction.
//
// To refresh the fixture after a prompt/schema change, run the live capture (see
// README "Re-recording the extraction fixture").

import { readFileSync } from "node:fs"
import path from "node:path"

import { hashContent, primeMemoryCache } from "@/lib/extraction/cache"
import type { ExtractionResult } from "@/lib/extraction/schema"
import fixture from "./fixtures/nightlog-extraction.json"

const log = readFileSync(path.join(process.cwd(), "data", "night-logs.md"), "utf8")
primeMemoryCache(hashContent(log), fixture as ExtractionResult)
