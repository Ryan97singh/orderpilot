"use client";

import { Loader2, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { MANAGER_ROUTES, PUBLIC_ROUTES, matchesRoute } from "./nav";
import { buttonClasses } from "./ui/button";

function PageLoading({ label }: { label: string }) {
  return (
    <div role="status" className="flex min-h-[60vh] items-center justify-center gap-2 text-sm text-muted">
      <Loader2 aria-hidden className="size-4 animate-spin" />
      {label}
    </div>
  );
}

/** Client-side route guard. The APIs enforce roles too; this keeps the UI honest. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status, endedBy, isManager } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = matchesRoute(pathname, PUBLIC_ROUTES);

  // Visitors who arrived signed out come back here after login; an expired session says so;
  // an explicit sign-out just starts fresh.
  useEffect(() => {
    if (status !== "anonymous" || isPublic) return;
    const target =
      endedBy === "logout" ? "/" : endedBy === "expired" ? "/?expired=1" : `/?next=${encodeURIComponent(pathname)}`;
    router.replace(target);
  }, [status, endedBy, isPublic, pathname, router]);

  if (isPublic) return children;

  if (status !== "authenticated") {
    return <PageLoading label={status === "loading" ? "Restoring your session…" : "Redirecting to sign in…"} />;
  }

  if (matchesRoute(pathname, MANAGER_ROUTES) && !isManager) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-6 py-20 text-center">
        <ShieldAlert aria-hidden className="size-10 text-muted" strokeWidth={1.5} />
        <h1 className="mt-4 text-lg font-semibold">Managers only</h1>
        <p className="mt-1 text-sm text-muted">
          This page is for sales managers. Sign out and choose the Manager role to see it.
        </p>
        <Link href="/chat" className={`${buttonClasses({ variant: "secondary" })} mt-6`}>
          Back to chat
        </Link>
      </div>
    );
  }

  return children;
}
