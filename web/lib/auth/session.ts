/**
 * Auth session store shared by both auth modes. React reads it via useSyncExternalStore
 * (lib/auth/auth-context.tsx); lib/api.ts reads tokens from it without needing React.
 */
import type { User } from "@/lib/types";
import { decodeJwt } from "./jwt";

export type AuthStatus = "loading" | "anonymous" | "authenticated";

export interface Session {
  status: AuthStatus;
  user: User | null;
  /** Why the session ended; the route guard only redirects for visitors who were never signed in. */
  endedBy?: "logout" | "expired";
}

/** Supplies a bearer token for API calls (demo: stored JWT; entra: MSAL acquireTokenSilent). */
export type TokenProvider = () => Promise<string | null>;

const STORAGE_KEY = "orderpilot.session";
const LOADING: Session = { status: "loading", user: null };

let session: Session = LOADING;
let tokenProvider: TokenProvider = async () => null;
let unauthorizedHandler: (() => void) | null = null;
const listeners = new Set<() => void>();

function emit(next: Session) {
  session = next;
  listeners.forEach((listener) => listener());
}

export const sessionStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: () => session,
  getServerSnapshot: () => LOADING,

  signedIn(user: User, provider: TokenProvider) {
    tokenProvider = provider;
    emit({ status: "authenticated", user });
  },
  signedOut(endedBy?: Session["endedBy"]) {
    tokenProvider = async () => null;
    emit({ status: "anonymous", user: null, endedBy });
  },
};

export function getAccessToken(): Promise<string | null> {
  return tokenProvider();
}

/** lib/api.ts calls this on HTTP 401 so the provider can clear the session and redirect. */
export function notifyUnauthorized() {
  unauthorizedHandler?.();
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

// ── Demo-mode persistence (sessionStorage, as the spec asks: cleared when the tab closes) ──

interface StoredDemoSession {
  token: string;
  user: User;
}

export const demoSessionStorage = {
  save(value: StoredDemoSession) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch {
      // Storage can be unavailable (private mode); the session then lasts for this page only.
    }
  },
  /** Returns the stored session if its token has not expired. */
  load(): StoredDemoSession | null {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const stored = JSON.parse(raw) as StoredDemoSession;
      const exp = decodeJwt(stored.token)?.exp;
      if (typeof exp === "number" && exp * 1000 < Date.now()) {
        sessionStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return stored;
    } catch {
      return null;
    }
  },
  clear() {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  },
};
