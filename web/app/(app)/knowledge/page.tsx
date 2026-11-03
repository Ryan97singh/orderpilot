"use client";

import { useQuery } from "@tanstack/react-query";
import { BookOpen, FileText, Search } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/feedback";
import { Input } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queries";

const EXAMPLES = ["credit limit approval", "returns damaged goods", "delivery schedule", "promotions stacking", "new outlet onboarding"];

/** Wraps query terms in <mark> so reps can see why a passage matched. */
function Highlight({ text, query }: { text: string; query: string }) {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!terms.length) return <>{text}</>;
  const parts = text.split(new RegExp(`(${terms.join("|")})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="rounded-sm bg-warning-soft text-foreground">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

export default function KnowledgePage() {
  const [input, setInput] = useState("");
  const [submitted, setSubmitted] = useState("");

  const query = useQuery({
    queryKey: queryKeys.knowledge(submitted),
    queryFn: ({ signal }) => api.ai.knowledgeSearch({ query: submitted, top_k: 5 }, signal),
    enabled: submitted.length > 0,
  });

  function search(text: string) {
    const q = text.trim();
    setInput(q);
    setSubmitted(q);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    search(input);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 lg:px-8 lg:py-8">
      <PageHeader
        title="Knowledge"
        description="Search company policies: credit, promotions, returns, delivery and onboarding. The agent cites the same sources in chat."
      />

      <form role="search" onSubmit={onSubmit} className="flex gap-2">
        <label htmlFor="kb-search" className="sr-only">
          Search the knowledge base
        </label>
        <div className="relative flex-1">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <Input
            id="kb-search"
            type="search"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. when does an order need approval?"
            className="pl-9"
          />
        </div>
        <Button type="submit" disabled={!input.trim()} loading={query.isFetching}>
          Search
        </Button>
      </form>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="py-1 text-xs text-muted">Try:</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => search(ex)}
            className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-muted hover:border-border-strong hover:text-foreground"
          >
            {ex}
          </button>
        ))}
      </div>

      <section aria-label="Results" aria-live="polite" className="mt-6">
        {!submitted ? (
          <EmptyState icon={BookOpen} title="Search the policy library">
            Results show the matching passage and the source document.
          </EmptyState>
        ) : query.isPending ? (
          <LoadingRows rows={3} label="Searching" />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} title="Search failed" />
        ) : query.data.length === 0 ? (
          <EmptyState icon={BookOpen} title={`No passages match "${submitted}"`}>
            Try different words, or ask the agent in chat.
          </EmptyState>
        ) : (
          <ol className="flex flex-col gap-3">
            {query.data.map((hit, i) => (
              <li key={`${hit.doc}-${i}`} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-semibold">{hit.title}</h2>
                  {typeof hit.score === "number" && (
                    <span className="shrink-0 text-xs text-muted tabular-nums" title="Relevance score">
                      score {hit.score.toFixed(2)}
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-sm leading-relaxed">
                  <Highlight text={hit.snippet} query={submitted} />
                </p>
                <p className="mt-2 inline-flex items-center gap-1 font-mono text-xs text-muted">
                  <FileText aria-hidden className="size-3.5" /> {hit.doc}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
