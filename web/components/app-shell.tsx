"use client";

import { LogIn, LogOut, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { config } from "@/lib/config";
import { cn } from "@/lib/format";
import { usePendingApprovalCount } from "@/lib/queries";
import { Logo } from "./logo";
import { NAV_ITEMS, isActive, primaryTabs, type NavItem } from "./nav";
import { InstallButton } from "./install-button";
import { ThemeToggle } from "./theme-toggle";
import { buttonClasses } from "./ui/button";

function useVisibleNav(): NavItem[] {
  const { isManager } = useAuth();
  return NAV_ITEMS.filter((item) => !item.managerOnly || isManager);
}

function CountBadge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span className="ml-auto rounded-full bg-warning-soft px-1.5 py-px text-xs font-semibold text-warning">
      {count}
      <span className="sr-only"> pending</span>
    </span>
  );
}

function UserChip() {
  const { user, isManager } = useAuth();
  if (!user) return null;
  const initials = user.name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span
        aria-hidden
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary-text"
      >
        {initials}
      </span>
      <div className="min-w-0 leading-tight">
        <p className="truncate text-sm font-medium">{user.name}</p>
        <p className="text-xs text-muted">{isManager ? "Sales manager" : "Sales rep"}</p>
      </div>
    </div>
  );
}

function SidebarNav({ label = "Main" }: { label?: string }) {
  const pathname = usePathname();
  const items = useVisibleNav();
  const pending = usePendingApprovalCount();
  return (
    <nav aria-label={label} className="flex flex-col gap-0.5">
      {items.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-primary-soft text-primary-text" : "text-muted hover:bg-surface-muted hover:text-foreground",
            )}
          >
            <Icon aria-hidden className="size-4.5 shrink-0" />
            {label}
            {href === "/approvals" && <CountBadge count={pending} />}
          </Link>
        );
      })}
    </nav>
  );
}

/** Full menu for small screens, built on <dialog> for focus handling and Esc-to-close. */
function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { logout, mode } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Close after navigating.
  useEffect(() => {
    onClose();
  }, [pathname, onClose]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-label="Menu"
      className="mt-auto mb-0 w-full max-w-none rounded-t-2xl border border-border bg-surface p-0 text-foreground backdrop:bg-black/40"
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <UserChip />
        <button
          type="button"
          onClick={onClose}
          className="inline-flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-muted"
          aria-label="Close menu"
        >
          <X aria-hidden className="size-5" />
        </button>
      </div>
      <div className="max-h-[70vh] overflow-y-auto p-3">
        <SidebarNav label="All pages" />
      </div>
      <div className="flex items-center justify-between border-t border-border px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-2 text-sm text-muted">
          <ThemeToggle /> Theme
        </div>
        <button type="button" onClick={() => void logout()} className={buttonClasses({ variant: "secondary", size: "sm" })}>
          <LogOut aria-hidden className="size-4" /> Sign out{mode === "entra" ? " of Microsoft" : ""}
        </button>
      </div>
    </dialog>
  );
}

function BottomTabs({ onMore }: { onMore: () => void }) {
  const pathname = usePathname();
  const { isManager } = useAuth();
  const pending = usePendingApprovalCount();
  const tabs = primaryTabs(isManager)
    .map((href) => NAV_ITEMS.find((i) => i.href === href))
    .filter((i): i is NavItem => Boolean(i));

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="grid grid-cols-5">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-16 flex-col items-center justify-center gap-1 text-[0.7rem] font-medium",
                  active ? "text-primary-text" : "text-muted",
                )}
              >
                <Icon aria-hidden className="size-5" />
                {label}
                {href === "/approvals" && pending > 0 && (
                  <span className="absolute top-2 left-[calc(50%+6px)] rounded-full bg-warning px-1 text-[0.6rem] leading-4 font-semibold text-background">
                    {pending}
                    <span className="sr-only"> pending</span>
                  </span>
                )}
              </Link>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            onClick={onMore}
            className="flex h-16 w-full flex-col items-center justify-center gap-1 text-[0.7rem] font-medium text-muted"
          >
            <Menu aria-hidden className="size-5" />
            More
          </button>
        </li>
      </ul>
    </nav>
  );
}

function MockBadge() {
  if (!config.useMocks) return null;
  return (
    <span className="rounded-md border border-dashed border-border-strong px-1.5 py-0.5 text-[0.65rem] font-medium tracking-wide text-muted uppercase">
      Mock data
    </span>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { status, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const signedIn = status === "authenticated";

  return (
    <div className="flex min-h-dvh">
      {signedIn && (
        <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border bg-surface px-3 py-4 lg:flex">
          <div className="flex items-center justify-between px-2">
            <Logo href="/chat" />
            <MockBadge />
          </div>
          <div className="mt-6 flex-1 overflow-y-auto">
            <SidebarNav />
          </div>
          <div className="mt-4 flex flex-col gap-3 border-t border-border px-2 pt-4">
            <UserChip />
            <InstallButton className="[&>button]:w-full" />
            <div className="flex items-center justify-between">
              <ThemeToggle />
              <button
                type="button"
                onClick={() => void logout()}
                className={buttonClasses({ variant: "ghost", size: "sm" })}
              >
                <LogOut aria-hidden className="size-4" /> Sign out
              </button>
            </div>
          </div>
        </aside>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className={cn(
            "sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-border bg-surface/95 px-4 backdrop-blur",
            signedIn && "lg:hidden",
          )}
        >
          <div className="flex items-center gap-2">
            <Logo href={signedIn ? "/chat" : "/"} />
            <MockBadge />
          </div>
          <div className="flex items-center gap-1">
            <InstallButton />
            <ThemeToggle />
            {status === "anonymous" && (
              <Link href="/" className={buttonClasses({ size: "sm" })}>
                <LogIn aria-hidden className="size-4" /> Sign in
              </Link>
            )}
          </div>
        </header>

        <main id="main" className={cn("flex-1", signedIn && "pb-20 lg:pb-0")}>
          {children}
        </main>
      </div>

      {signedIn && (
        <>
          <BottomTabs onMore={() => setMenuOpen(true)} />
          <MobileMenu open={menuOpen} onClose={closeMenu} />
        </>
      )}
    </div>
  );
}
