"use client";

import { FileText } from "lucide-react";
import { useId, useState } from "react";
import { cn } from "@/lib/format";
import type { Citation } from "@/lib/types";

/** Source chips under a knowledge answer; selecting one reveals the cited passage. */
export function Citations({ citations }: { citations: Citation[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const panelId = useId();
  if (!citations.length) return null;
  const selected = open === null ? null : citations[open];

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-muted">Sources</p>
      <ul className="flex flex-wrap gap-1.5">
        {citations.map((c, i) => (
          <li key={`${c.doc}-${i}`}>
            <button
              type="button"
              aria-expanded={open === i}
              aria-controls={panelId}
              onClick={() => setOpen(open === i ? null : i)}
              className={cn(
                "inline-flex max-w-[16rem] items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                open === i
                  ? "border-primary bg-primary-soft text-primary-text"
                  : "border-border bg-surface text-muted hover:border-border-strong hover:text-foreground",
              )}
            >
              <FileText aria-hidden className="size-3.5 shrink-0" />
              <span className="truncate">{c.title}</span>
            </button>
          </li>
        ))}
      </ul>
      {selected && (
        <blockquote id={panelId} className="rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm">
          <p className="leading-relaxed">{selected.snippet}</p>
          <footer className="mt-1 font-mono text-xs text-muted">{selected.doc}</footer>
        </blockquote>
      )}
    </div>
  );
}
