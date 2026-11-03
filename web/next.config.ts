import type { NextConfig } from "next";

// The service worker proxies catalog GETs to core-api, so its CSP must allow that origin.
const apiOrigins = [process.env.NEXT_PUBLIC_CORE_API_URL || "http://localhost:8080", process.env.NEXT_PUBLIC_AI_API_URL || "http://localhost:8000"]
  .map((url) => new URL(url).origin)
  .join(" ");

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image (Azure Container Apps).
  output: "standalone",
  // Cache Components is intentionally off: every page is a client-rendered view behind a
  // bearer-token API, so there is no server data to cache, and the flag would force Suspense
  // boundaries around auth-gated segments.
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        // The service worker must never be served from HTTP cache, or updates get stuck.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: `default-src 'self'; script-src 'self'; connect-src 'self' ${apiOrigins}` },
        ],
      },
    ];
  },
};

export default nextConfig;
