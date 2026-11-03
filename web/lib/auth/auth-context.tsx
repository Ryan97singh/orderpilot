"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { createContext, use, useCallback, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { api } from "@/lib/api";
import { config, type AuthMode } from "@/lib/config";
import type { Role, User } from "@/lib/types";
import { entraAuth } from "./entra";
import { demoSessionStorage, sessionStore, setUnauthorizedHandler, type AuthStatus, type Session } from "./session";

interface AuthContextValue {
  mode: AuthMode;
  status: AuthStatus;
  user: User | null;
  endedBy: Session["endedBy"];
  isManager: boolean;
  hasRole: (role: Role) => boolean;
  /** Demo mode: signs in as the given role. Entra mode: opens the Microsoft sign-in popup (role ignored). */
  login: (role?: Role) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function demoTokenProvider(token: string) {
  return async () => token;
}

/** Restores an existing session on first load (sessionStorage for demo, MSAL cache for Entra). */
async function restoreSession() {
  if (config.authMode === "demo") {
    const stored = demoSessionStorage.load();
    if (stored) sessionStore.signedIn(stored.user, demoTokenProvider(stored.token));
    else sessionStore.signedOut();
    return;
  }
  try {
    const restored = await entraAuth.restore();
    if (restored) sessionStore.signedIn(restored.user, entraAuth.tokenProvider(restored.account));
    else sessionStore.signedOut();
  } catch {
    sessionStore.signedOut();
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const session = useSyncExternalStore(sessionStore.subscribe, sessionStore.getSnapshot, sessionStore.getServerSnapshot);
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (sessionStore.getSnapshot().status === "loading") void restoreSession();
  }, []);

  const clearLocalSession = useCallback(
    (endedBy: "logout" | "expired") => {
      demoSessionStorage.clear();
      sessionStore.signedOut(endedBy);
      queryClient.clear();
    },
    [queryClient],
  );

  // An expired/invalid token anywhere in the app sends the user back to sign in.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearLocalSession("expired");
      router.replace("/?expired=1");
    });
    return () => setUnauthorizedHandler(null);
  }, [clearLocalSession, router]);

  const login = useCallback(async (role: Role = "REP") => {
    if (config.authMode === "demo") {
      const { token, user } = await api.auth.demoLogin(role);
      demoSessionStorage.save({ token, user });
      sessionStore.signedIn(user, demoTokenProvider(token));
    } else {
      const { user, account } = await entraAuth.login();
      sessionStore.signedIn(user, entraAuth.tokenProvider(account));
    }
  }, []);

  const logout = useCallback(async () => {
    clearLocalSession("logout");
    if (config.authMode === "entra") await entraAuth.logout().catch(() => undefined);
    router.replace("/");
  }, [clearLocalSession, router]);

  const value = useMemo<AuthContextValue>(() => {
    const roles = session.user?.roles ?? [];
    return {
      mode: config.authMode,
      status: session.status,
      user: session.user,
      endedBy: session.endedBy,
      isManager: roles.includes("MANAGER"),
      hasRole: (role) => roles.includes(role),
      login,
      logout,
    };
  }, [session, login, logout]);

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const ctx = use(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
