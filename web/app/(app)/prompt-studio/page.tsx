"use client";

import { useMutation } from "@tanstack/react-query";
import { Check, ClipboardCopy, ListChecks, Sparkles, Wand2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert, EmptyState, Skeleton } from "@/components/ui/feedback";
import { Field, Select, Textarea } from "@/components/ui/field";
import { Markdown } from "@/components/ui/markdown";
import { PageHeader } from "@/components/ui/page-header";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/api-error";
import type { PromptLayer, PromptStudioResponse } from "@/lib/types";

const LAYERS: { value: PromptLayer; label: string }[] = [
  { value: "fullstack", label: "Full stack" },
  { value: "backend", label: "Backend (Spring Boot)" },
  { value: "frontend", label: "Frontend (Next.js)" },
  { value: "ai", label: "AI service (FastAPI + LangGraph)" },
];

const EXAMPLE =
  "Managers want to set a per-outlet monthly order cap. If a rep's order would push the outlet over its cap, the order must go to approval. Managers should see which outlets are close to their cap on the dashboard.";

function AnalysisList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">{title}</h3>
      {items.length ? (
        <ul className="mt-1.5 flex flex-col gap-1 text-sm">
          {items.map((item) => (
            <li key={item} className="flex gap-2">
              <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-border-strong" />
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1.5 text-sm text-muted">None identified</p>
      )}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked (e.g. insecure context); the prompt is still selectable.
    }
  }
  return (
    <Button size="sm" variant="secondary" onClick={() => void copy()}>
      {copied ? <Check aria-hidden className="size-4 text-success" /> : <ClipboardCopy aria-hidden className="size-4" />}
      <span aria-live="polite">{copied ? "Copied" : "Copy prompt"}</span>
    </Button>
  );
}

function Result({ result }: { result: PromptStudioResponse }) {
  const { analysis } = result;
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader title="Analysis" description="What the model understood from the requirement." />
        <CardBody className="grid gap-5 sm:grid-cols-2">
          <AnalysisList title="Actors" items={analysis.actors} />
          <AnalysisList title="Entities" items={analysis.entities} />
          <AnalysisList title="Business rules" items={analysis.rules} />
          <AnalysisList title="Open questions" items={analysis.open_questions} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Structured Claude prompt"
          description="Paste into Claude Code to generate the change."
          action={<CopyButton text={result.prompt} />}
        />
        <CardBody>
          <div className="max-h-[32rem] overflow-y-auto rounded-lg border border-border bg-surface-muted/60 p-4">
            <Markdown>{result.prompt}</Markdown>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={
            <span className="inline-flex items-center gap-1.5">
              <ListChecks aria-hidden className="size-4 text-primary-text" /> Acceptance criteria
            </span>
          }
        />
        <CardBody>
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm marker:text-muted">
            {result.acceptance_criteria.map((c) => (
              <li key={c} className="pl-1 leading-relaxed">
                {c}
              </li>
            ))}
          </ol>
        </CardBody>
      </Card>
    </div>
  );
}

export default function PromptStudioPage() {
  const [requirement, setRequirement] = useState("");
  const [layer, setLayer] = useState<PromptLayer>("fullstack");
  const generate = useMutation({ mutationFn: api.ai.promptStudio });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (requirement.trim()) generate.mutate({ requirement: requirement.trim(), layer });
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8 lg:py-8">
      <PageHeader
        title="Prompt Studio"
        description="Turn a business requirement into a structured build prompt for Claude, with acceptance criteria. This is how OrderPilot itself was built."
      />

      <div className="grid items-start gap-6 lg:grid-cols-[22rem_1fr]">
        <Card className="lg:sticky lg:top-6">
          <form onSubmit={onSubmit}>
            <CardBody className="flex flex-col gap-4">
              <Field label="Business requirement" hint="Plain language is fine: who needs what, and the rules.">
                {({ id, describedBy }) => (
                  <Textarea
                    id={id}
                    aria-describedby={describedBy}
                    rows={8}
                    value={requirement}
                    onChange={(e) => setRequirement(e.target.value)}
                    placeholder="e.g. Managers want to set a monthly order cap per outlet…"
                    required
                  />
                )}
              </Field>
              <Field label="Target layer">
                {({ id }) => (
                  <Select id={id} value={layer} onChange={(e) => setLayer(e.target.value as PromptLayer)}>
                    {LAYERS.map((l) => (
                      <option key={l.value} value={l.value}>
                        {l.label}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" loading={generate.isPending} disabled={!requirement.trim()}>
                  <Wand2 aria-hidden className="size-4" /> Generate prompt
                </Button>
                {!requirement && (
                  <Button variant="ghost" onClick={() => setRequirement(EXAMPLE)}>
                    Use an example
                  </Button>
                )}
              </div>
            </CardBody>
          </form>
        </Card>

        <section aria-label="Generated prompt" aria-live="polite" aria-busy={generate.isPending}>
          {generate.isError && (
            <Alert tone="danger" title="Couldn't generate the prompt" className="mb-4">
              {errorMessage(generate.error)}
            </Alert>
          )}
          {generate.isPending ? (
            <div className="flex flex-col gap-4" role="status">
              <span className="sr-only">Generating…</span>
              <Skeleton className="h-40" />
              <Skeleton className="h-72" />
            </div>
          ) : generate.data ? (
            <Result result={generate.data} />
          ) : (
            <EmptyState icon={Sparkles} title="Your structured prompt will appear here">
              Describe a requirement and pick the layer it touches. The AI service extracts actors, entities and rules,
              then writes a Claude-ready prompt.
            </EmptyState>
          )}
        </section>
      </div>
    </div>
  );
}
