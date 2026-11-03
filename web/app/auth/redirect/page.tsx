"use client";

import { useEffect } from "react";

/**
 * MSAL v5 redirect bridge: Entra redirects the sign-in popup here, and this page relays the
 * auth response back to the main window. Register `<origin>/auth/redirect` as a SPA redirect URI.
 */
export default function AuthRedirectPage() {
  useEffect(() => {
    void import("@azure/msal-browser/redirect-bridge").then(({ broadcastResponseToMainFrame }) =>
      broadcastResponseToMainFrame().catch((error: unknown) => console.error("MSAL redirect bridge failed", error)),
    );
  }, []);

  return <p className="p-6 text-sm text-muted">Completing sign-in…</p>;
}
