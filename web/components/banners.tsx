"use client";

import { useQueryClient } from "@tanstack/react-query";
import { CloudOff, Loader2, RotateCw, WifiOff } from "lucide-react";
import { useSyncExternalStore } from "react";
import { networkStatus } from "@/lib/network-status";

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

export function useOnline() {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
}

const BAR = "flex items-center justify-center gap-2 px-4 py-2 text-center text-sm";

/**
 * Global connectivity banners:
 *  - offline (browser has no network) — cached catalog and pages still work via the service worker;
 *  - cold start (an API call has taken >5s: the free-tier server is waking up);
 *  - unreachable (a call failed outright) with a Retry that refetches active queries.
 */
export function ConnectivityBanners() {
  const online = useOnline();
  const { slowCount, unreachable } = useSyncExternalStore(
    networkStatus.subscribe,
    networkStatus.getSnapshot,
    networkStatus.getServerSnapshot,
  );
  const queryClient = useQueryClient();

  const retry = () => {
    networkStatus.markReachable();
    void queryClient.refetchQueries({ type: "active" });
  };

  if (!online) {
    return (
      <div role="status" className={`${BAR} bg-foreground text-background`}>
        <WifiOff aria-hidden className="size-4 shrink-0" />
        You&apos;re offline. Showing cached data where available.
      </div>
    );
  }

  if (slowCount > 0) {
    return (
      <div role="status" aria-live="polite" className={`${BAR} bg-warning-soft text-warning`}>
        <Loader2 aria-hidden className="size-4 shrink-0 animate-spin" />
        <span>
          <strong className="font-semibold">Waking up the free server…</strong> The demo backend sleeps when idle; the
          first request can take up to a minute.
        </span>
      </div>
    );
  }

  if (unreachable) {
    return (
      <div role="alert" className={`${BAR} bg-danger-soft text-danger`}>
        <CloudOff aria-hidden className="size-4 shrink-0" />
        <span>Couldn&apos;t reach the server. It may still be starting.</span>
        <button
          type="button"
          onClick={retry}
          className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-medium underline underline-offset-2 hover:bg-danger/10"
        >
          <RotateCw aria-hidden className="size-3.5" /> Retry
        </button>
      </div>
    );
  }

  return null;
}
