import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // The pipeline reads the bundled sample data + committed extraction recordings at runtime
  // (ADR 0008, in-memory, no DB). Shipping the recordings is what keeps a known log a cache
  // hit on stateless cold starts — no model call, no per-request cost.
  outputFileTracingIncludes: {
    "/": ["./data/**", "./lib/extraction/recorded/**"],
    "/api/handover": ["./data/**", "./lib/extraction/recorded/**"],
    "/api/debug": ["./data/**", "./lib/extraction/recorded/**"],
  },
}

export default nextConfig
