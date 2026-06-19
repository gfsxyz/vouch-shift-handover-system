import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // The pipeline reads the bundled sample data at runtime (ADR 0008, in-memory, no DB).
  // Ensure those files ship inside the serverless functions.
  outputFileTracingIncludes: {
    "/": ["./data/**"],
    "/api/handover": ["./data/**"],
    "/api/debug": ["./data/**"],
  },
}

export default nextConfig
