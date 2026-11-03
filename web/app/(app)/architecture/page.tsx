import {
  Activity,
  BrainCircuit,
  Cloud,
  Database,
  FileCode2,
  FlaskConical,
  Globe,
  KeyRound,
  ListChecks,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { SystemDiagram, SystemStack } from "@/components/architecture/system-diagram";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = {
  title: "Architecture",
  description: "How OrderPilot is put together, how an order flows through it, and how it was built with Claude.",
};

const FLOW: { who: string; what: string; detail: string }[] = [
  { who: "PWA", what: "Rep types the order", detail: "“Order 20 cases of FizzUp Cola 330ml for Al Noor Grocery” → POST /ai/chat with the user's bearer token and an X-Request-Id." },
  { who: "AI service", what: "classify_intent", detail: "LangGraph routes the message to the ORDER branch (vs KNOWLEDGE or GENERAL)." },
  { who: "AI service", what: "extract_order", detail: "The LLM returns structured output: outlet reference plus lines of product reference and quantity." },
  { who: "AI → Core", what: "resolve_entities", detail: "Tools call GET /api/outlets?q= and /api/products?q= on core-api, forwarding the user's token, so permissions still apply." },
  { who: "AI → Core", what: "quote", detail: "POST /api/orders/quote prices the lines: best promotion, city-warehouse stock check, credit status." },
  { who: "PWA", what: "propose: confirmation card", detail: "The agent returns the quote and a pending PLACE_ORDER action. It never places the order itself." },
  { who: "PWA → AI", what: "Rep confirms", detail: "POST /ai/chat/confirm. The AI service calls POST /api/orders with an Idempotency-Key, so a double tap can't create two orders." },
  { who: "Core", what: "Order created", detail: "CONFIRMED and stock reserved, or PENDING_APPROVAL if it breaks the credit limit. Managers approve it in the app." },
];

const AZURE: { icon: LucideIcon; name: string; role: string }[] = [
  { icon: Globe, name: "Static Web Apps", role: "Hosts the Next.js PWA (or Container Apps for the standalone server)." },
  { icon: Cloud, name: "Container Apps", role: "Runs core-api and ai-service containers with scale-to-zero and revisions." },
  { icon: Database, name: "Azure SQL", role: "Outlets, products, inventory, promotions and orders (Flyway migrations)." },
  { icon: Search, name: "Azure AI Search", role: "Indexes the policy documents for retrieval with citations." },
  { icon: BrainCircuit, name: "Azure OpenAI / AI Foundry", role: "LLM endpoint; Claude via the Anthropic API or Foundry, chosen by env." },
  { icon: KeyRound, name: "Key Vault", role: "JWT secret, API keys and connection strings, read with managed identity." },
  { icon: ShieldCheck, name: "Entra ID", role: "SPA and API app registrations; app roles REP and MANAGER in the token." },
  { icon: Activity, name: "Application Insights", role: "Structured JSON logs and traces, correlated by X-Request-Id." },
];

const WORKFLOW: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: ListChecks, title: "Requirements", body: "One shared contract (docs/SPEC.md): endpoints, shapes, business rules, auth." },
  { icon: FileCode2, title: "Structured prompts", body: "Each service gets a prompt with role, context, constraints and acceptance criteria." },
  { icon: Sparkles, title: "Generated code", body: "Claude Code builds each service in parallel against the same contract." },
  { icon: FlaskConical, title: "Review & tests", body: "Human review, JUnit / pytest / typecheck + lint + build, and a browser walk-through." },
  { icon: RefreshCcw, title: "Iterate", body: "Findings feed back into the prompts; contract deviations are written down, not hidden." },
];

const STACK = [
  ["Web", "Next.js (App Router), React, TypeScript strict, Tailwind CSS, TanStack Query, MSAL, PWA"],
  ["AI", "Python 3.12, FastAPI, LangGraph, Anthropic SDK, Azure OpenAI, Azure AI Search"],
  ["Core", "Java 21, Spring Boot 3, Spring Data JPA, Flyway, Spring Security, Spring AI"],
  ["Ops", "Docker per service, docker-compose, Azure Container Apps, structured JSON logs, request IDs"],
];

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-10 first:mt-0">
      <h2 id={id} className="text-lg font-semibold tracking-tight">
        {title}
      </h2>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function ArchitecturePage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 lg:px-8 lg:py-10">
      <PageHeader
        title="Architecture"
        description="For interviewers: how OrderPilot fits together, what happens when a rep orders by chat, and how it was built."
        actions={<Badge tone="primary">Demo data only</Badge>}
      />

      <Section id="system" title="System overview">
        <div className="hidden rounded-xl border border-border bg-background p-4 md:block">
          <SystemDiagram />
        </div>
        <div className="md:hidden">
          <SystemStack />
        </div>
      </Section>

      <Section id="flow" title="Request flow: placing an order by chat" description="Human-in-the-loop by design: the agent proposes, the rep decides.">
        <ol className="relative flex flex-col gap-4 border-l border-border pl-6">
          {FLOW.map((step, i) => (
            <li key={step.what} className="relative">
              <span
                aria-hidden
                className="absolute top-0 -left-[2.3rem] inline-flex size-7 items-center justify-center rounded-full border border-border bg-surface text-xs font-semibold tabular-nums"
              >
                {i + 1}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold">{step.what}</p>
                <Badge>{step.who}</Badge>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-muted">{step.detail}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section
        id="azure"
        title="Target Azure deployment"
        description="The demo runs on free tiers (Vercel + Render); each piece maps one-to-one to an Azure service."
      >
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {AZURE.map(({ icon: Icon, name, role }) => (
            <li key={name} className="flex gap-3 rounded-xl border border-border bg-surface p-4">
              <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-primary-text" />
              <div>
                <p className="text-sm font-semibold">{name}</p>
                <p className="mt-0.5 text-sm text-muted">{role}</p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="claude" title="Built with Claude" description="A repeatable workflow, not one giant prompt.">
        <ol className="grid gap-3 sm:grid-cols-5">
          {WORKFLOW.map(({ icon: Icon, title, body }, i) => (
            <li key={title} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted tabular-nums">{i + 1}</span>
                <Icon aria-hidden className="size-4 text-primary-text" />
              </div>
              <p className="mt-2 text-sm font-semibold">{title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">{body}</p>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm text-muted">
          The prompts used to build each service live in the repo&apos;s{" "}
          <code className="rounded bg-surface-muted px-1 py-0.5 font-mono text-xs text-foreground">prompts/</code> folder.
          The same idea is productised in{" "}
          <Link href="/prompt-studio" className="font-medium text-primary-text underline-offset-2 hover:underline">
            Prompt Studio
          </Link>
          , which turns a business requirement into a structured Claude prompt with acceptance criteria.
        </p>
      </Section>

      <Section id="stack" title="Tech stack">
        <dl className="divide-y divide-border rounded-xl border border-border bg-surface">
          {STACK.map(([layer, tech]) => (
            <div key={layer} className="grid gap-1 px-4 py-3 sm:grid-cols-[6rem_1fr]">
              <dt className="text-sm font-semibold">{layer}</dt>
              <dd className="text-sm text-muted">{tech}</dd>
            </div>
          ))}
        </dl>
      </Section>
    </div>
  );
}
