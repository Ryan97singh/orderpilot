"use client";

import { useEffect } from "react";
// Imported here (mounted in the root layout) so the install-prompt listener is attached as early as possible.
import "@/lib/install";

/**
 * Registers public/sw.js in production builds. Skipped in `next dev`, where a caching
 * service worker would serve stale bundles during hot reload.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch((error) => {
      console.warn("Service worker registration failed", error);
    });
  }, []);
  return null;
}
