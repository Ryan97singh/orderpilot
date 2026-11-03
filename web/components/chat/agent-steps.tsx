import { ChevronRight, Workflow } from "lucide-react";
import type { AgentStep } from "@/lib/types";

/** Collapsible trace of the LangGraph nodes the agent ran for this reply. */
export function AgentSteps({ steps }: { steps: AgentStep[] }) {
  if (!steps.length) return null;
  return (
    <details className="group text-xs text-muted">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-md px-1.5 py-1 font-medium hover:bg-surface-muted hover:text-foreground [&::-webkit-details-marker]:hidden">
        <ChevronRight aria-hidden className="size-3.5 transition-transform group-open:rotate-90" />
        <Workflow aria-hidden className="size-3.5" />
        Agent steps ({steps.length})
      </summary>
      <ol className="mt-2 ml-3 flex flex-col gap-2 border-l border-border pl-4">
        {steps.map((step, i) => (
          <li key={`${step.node}-${i}`} className="relative">
            <span aria-hidden className="absolute top-1.5 -left-[1.3rem] size-2 rounded-full border-2 border-surface bg-primary" />
            <span className="font-mono font-medium text-foreground">{step.node}</span>
            <p className="mt-0.5 leading-relaxed break-words">{step.detail}</p>
          </li>
        ))}
      </ol>
    </details>
  );
}
