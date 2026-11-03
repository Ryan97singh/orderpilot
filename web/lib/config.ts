/**
 * Public runtime configuration. Every value is a NEXT_PUBLIC_* variable, so it is inlined
 * at build time; change them by rebuilding (see README → Environment variables).
 */

export type AuthMode = "demo" | "entra";

function trimSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

const authMode: AuthMode = process.env.NEXT_PUBLIC_AUTH_MODE === "entra" ? "entra" : "demo";
const entraClientId = process.env.NEXT_PUBLIC_ENTRA_CLIENT_ID ?? "";

export const config = {
  coreApiUrl: trimSlash(process.env.NEXT_PUBLIC_CORE_API_URL || "http://localhost:8080"),
  aiApiUrl: trimSlash(process.env.NEXT_PUBLIC_AI_API_URL || "http://localhost:8000"),
  authMode,
  entra: {
    clientId: entraClientId,
    tenantId: process.env.NEXT_PUBLIC_ENTRA_TENANT_ID ?? "",
    /** Space- or comma-separated scopes for the core-api / ai-service access token. */
    scopes: (process.env.NEXT_PUBLIC_ENTRA_SCOPES || (entraClientId ? `api://${entraClientId}/access_as_user` : ""))
      .split(/[\s,]+/)
      .filter(Boolean),
  },
  /** Dev-only: serve fixture data from lib/mocks.ts instead of calling the APIs. */
  useMocks: process.env.NEXT_PUBLIC_USE_MOCKS === "true",
  /** Dev-only: simulated latency for mocks; set above 5000 to preview the cold-start banner. */
  mockLatencyMs: Number(process.env.NEXT_PUBLIC_MOCK_LATENCY_MS ?? 450),
  /** A request slower than this shows the "waking up the free server" banner. */
  slowRequestMs: 5000,
  /** Hard client-side timeout; Render free-tier cold starts can take ~60s. */
  requestTimeoutMs: 90_000,
} as const;
