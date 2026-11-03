"use client";

import { ArrowRight, BarChart3, Building2, MessageSquare } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { errorMessage } from "@/lib/api-error";
import { useAuth } from "@/lib/auth/auth-context";
import { cn } from "@/lib/format";
import type { Role } from "@/lib/types";

const ROLES: { role: Role; title: string; persona: string; icon: typeof MessageSquare; points: string[] }[] = [
  {
    role: "REP",
    title: "Sales Rep",
    persona: "Aisha Rahman · field sales, Dubai",
    icon: MessageSquare,
    points: ["Order by chat with AI quotes", "Check stock, credit & promotions", "Ask policy questions"],
  },
  {
    role: "MANAGER",
    title: "Manager",
    persona: "Omar Haddad · sales manager",
    icon: BarChart3,
    points: ["KPI dashboard & charts", "Approve over-limit orders", "AI order summaries"],
  },
];

/** Only allow same-site relative paths as post-login destinations. */
function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : null;
}

export function RolePicker() {
  const { mode, status, user, login, isManager } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [pending, setPending] = useState<Role | "entra" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const next = safeNext(params.get("next"));

  async function signIn(role?: Role) {
    setPending(role ?? "entra");
    setError(null);
    try {
      await login(role);
      router.push(next ?? (role === "MANAGER" ? "/dashboard" : "/chat"));
    } catch (e) {
      setError(errorMessage(e));
      setPending(null);
    }
  }

  if (status === "authenticated" && user) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 shadow-xs">
        <p className="text-sm text-muted">
          Signed in as <span className="font-medium text-foreground">{user.name}</span> (
          {isManager ? "Manager" : "Sales Rep"})
        </p>
        <Link href={next ?? (isManager ? "/dashboard" : "/chat")} className={buttonClasses()}>
          Continue <ArrowRight aria-hidden className="size-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {params.get("expired") && (
        <Alert tone="warning" title="Your session ended">
          Please sign in again to continue.
        </Alert>
      )}
      {error && (
        <Alert tone="danger" title="Sign-in failed">
          {error}
        </Alert>
      )}

      {mode === "entra" ? (
        <div className="rounded-xl border border-border bg-surface p-5 shadow-xs">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Building2 aria-hidden className="size-4 text-muted" /> Company sign-in
          </div>
          <p className="mt-1 text-sm text-muted">
            Sign in with your Microsoft Entra ID work account. Your app role (Sales Rep or Manager) comes from the
            directory.
          </p>
          <Button className="mt-4 w-full" onClick={() => void signIn()} loading={pending === "entra"}>
            Sign in with Microsoft
          </Button>
          {pending === "entra" && (
            // MSAL v5 can't see a popup being closed (COOP), so it waits for its own timeout.
            <p role="status" className="mt-2 text-xs text-muted">
              Finish signing in in the Microsoft window. Closed it by mistake? Reload this page to try again.
            </p>
          )}
        </div>
      ) : (
        <fieldset className="flex flex-col gap-3" disabled={pending !== null || status === "loading"}>
          <legend className="mb-1 text-sm font-medium">Try the demo as…</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {ROLES.map(({ role, title, persona, icon: Icon, points }) => (
              <button
                key={role}
                type="button"
                onClick={() => void signIn(role)}
                className={cn(
                  "group flex flex-col rounded-xl border border-border bg-surface p-4 text-left shadow-xs transition",
                  "hover:border-primary hover:shadow-sm disabled:opacity-60",
                )}
              >
                <span className="flex items-center justify-between">
                  <span className="inline-flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary-text">
                    <Icon aria-hidden className="size-4.5" />
                  </span>
                  <ArrowRight
                    aria-hidden
                    className={cn(
                      "size-4 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-primary-text",
                      pending === role && "animate-pulse",
                    )}
                  />
                </span>
                <span className="mt-3 font-semibold">{pending === role ? `Signing in as ${title}…` : title}</span>
                <span className="text-xs text-muted">{persona}</span>
                <ul className="mt-3 flex flex-col gap-1 text-sm text-muted">
                  {points.map((p) => (
                    <li key={p} className="flex gap-2">
                      <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-border-strong" />
                      {p}
                    </li>
                  ))}
                </ul>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted">
            Demo sign-in issues a short-lived token from the core API. No password needed. In production this is
            Microsoft Entra ID.
          </p>
        </fieldset>
      )}
    </div>
  );
}
