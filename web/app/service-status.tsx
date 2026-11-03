"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { cn } from "@/lib/format";

function StatusDot({ label, query }: { label: string; query: { isPending: boolean; isError: boolean } }) {
  const state = query.isPending ? "Waking up" : query.isError ? "Unavailable" : "Online";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden
        className={cn(
          "size-2 rounded-full",
          query.isPending ? "animate-pulse bg-warning" : query.isError ? "bg-danger" : "bg-success",
        )}
      />
      {label}: <span className="font-medium text-foreground">{state}</span>
    </span>
  );
}

/**
 * Pings both health endpoints as soon as the landing page opens, so free-tier servers start
 * waking while the visitor reads the pitch.
 */
export function ServiceStatus() {
  const core = useQuery({ queryKey: ["health", "core"], queryFn: ({ signal }) => api.health.core(signal), retry: 3 });
  const ai = useQuery({ queryKey: ["health", "ai"], queryFn: ({ signal }) => api.health.ai(signal), retry: 3 });
  return (
    <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-live="polite">
      <StatusDot label="Core API" query={core} />
      <StatusDot label="AI service" query={ai} />
    </p>
  );
}
