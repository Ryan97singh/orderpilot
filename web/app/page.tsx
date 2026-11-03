import { BookOpenCheck, LayoutDashboard, ShieldCheck, Smartphone, Workflow } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { InstallButton } from "@/components/install-button";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { RolePicker } from "./role-picker";
import { ServiceStatus } from "./service-status";

const FEATURES = [
  {
    icon: Workflow,
    title: "Agentic ordering, human-in-the-loop",
    body: "A LangGraph agent finds the outlet, checks stock and credit, applies promotions and quotes. It never places an order until the rep confirms.",
  },
  {
    icon: BookOpenCheck,
    title: "Grounded answers",
    body: "Policy questions are answered from company documents with citations, so reps can trust and verify what they're told.",
  },
  {
    icon: LayoutDashboard,
    title: "Manager control",
    body: "Over-limit orders wait for approval. Managers see revenue, AI vs UI order mix, low stock and AI-written order summaries.",
  },
  {
    icon: ShieldCheck,
    title: "Enterprise-ready",
    body: "Microsoft Entra ID sign-in, role-based access enforced by every API, and request IDs traced end to end.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav aria-label="Site" className="flex items-center gap-1">
          <Link
            href="/architecture"
            className="rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-muted hover:text-foreground max-sm:hidden"
          >
            Architecture
          </Link>
          <InstallButton />
          <ThemeToggle />
        </nav>
      </header>

      <main id="main" className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <section className="grid items-start gap-10 pt-6 sm:pt-12 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted">
              <Smartphone aria-hidden className="size-3.5" /> Installable PWA · works on any phone
            </p>
            <h1 className="mt-5 text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-4xl lg:text-5xl">
              The AI ordering copilot for beverage sales reps.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
              Type an order the way you&apos;d text it, like{" "}
              <span className="font-medium text-foreground">
                &ldquo;20 cases of FizzUp Cola for Al Noor Grocery&rdquo;
              </span>
              . OrderPilot checks stock, credit and promotions, then shows a quote for you to confirm.
            </p>
            <div className="mt-6">
              <ServiceStatus />
            </div>
          </div>

          <div className="lg:pt-2">
            <Suspense fallback={<div className="h-72 animate-pulse rounded-xl bg-surface-muted" />}>
              <RolePicker />
            </Suspense>
          </div>
        </section>

        <section aria-labelledby="features-heading" className="mt-16 sm:mt-20">
          <h2 id="features-heading" className="sr-only">
            Features
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <li key={title} className="rounded-xl border border-border bg-surface p-5">
                <Icon aria-hidden className="size-5 text-primary-text" />
                <h3 className="mt-3 text-sm font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>
              </li>
            ))}
          </ul>
        </section>

        <footer className="mt-16 flex flex-col gap-2 border-t border-border pt-6 text-xs text-muted sm:flex-row sm:justify-between">
          <p>Demo data only. All brands, outlets and people are fictional. Prices in AED.</p>
          <p>
            Next.js · Spring Boot · FastAPI + LangGraph · Azure.{" "}
            <Link href="/architecture" className="font-medium text-primary-text underline-offset-2 hover:underline">
              How it&apos;s built →
            </Link>
          </p>
        </footer>
      </main>
    </div>
  );
}
