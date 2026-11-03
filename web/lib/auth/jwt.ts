import type { Role, User } from "@/lib/types";

export type JwtClaims = Record<string, unknown> & { exp?: number };

/** Decodes a JWT payload without verifying it — the APIs verify; the UI only reads claims. */
export function decodeJwt(token: string): JwtClaims | null {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      Array.from(atob(base64), (c) => `%${c.charCodeAt(0).toString(16).padStart(2, "0")}`).join(""),
    );
    return JSON.parse(json) as JwtClaims;
  } catch {
    return null;
  }
}

/** Maps role claims (demo: "REP"/"MANAGER"; Entra app roles may be namespaced) to app roles. */
export function toRoles(raw: unknown): Role[] {
  const values = Array.isArray(raw) ? raw : typeof raw === "string" ? [raw] : [];
  const roles = new Set<Role>();
  for (const value of values) {
    const v = String(value).toUpperCase();
    if (v.includes("MANAGER")) roles.add("MANAGER");
    else if (v.includes("REP")) roles.add("REP");
  }
  return [...roles];
}

/** Builds a User from token claims; used when the login response omits or abbreviates `user`. */
export function userFromClaims(claims: JwtClaims, fallback?: Partial<User>): User {
  return {
    id: String(fallback?.id ?? claims.oid ?? claims.sub ?? "unknown"),
    name: String(fallback?.name ?? claims.name ?? claims.preferred_username ?? "Signed-in user"),
    roles: fallback?.roles?.length ? fallback.roles : toRoles(claims.roles),
    email: fallback?.email ?? (typeof claims.preferred_username === "string" ? claims.preferred_username : undefined),
  };
}
