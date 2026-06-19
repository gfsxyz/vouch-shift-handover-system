import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // The pipeline reads the bundled sample data + the committed extraction seed at runtime
  // (ADR 0008, in-memory, no DB). Ensure those files ship inside the serverless functions.
  outputFileTracingIncludes: {
    "/": ["./data/**", "./lib/extraction/seed/**"],
    "/api/handover": ["./data/**", "./lib/extraction/seed/**"],
    "/api/debug": ["./data/**", "./lib/extraction/seed/**"],
  },
}

export default nextConfig
