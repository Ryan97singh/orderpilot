/**
 * Microsoft Entra ID sign-in with MSAL (NEXT_PUBLIC_AUTH_MODE=entra).
 * The MSAL bundle is only downloaded in entra mode (dynamic import), keeping demo mode lean.
 *
 * MSAL v5 popups land on /auth/redirect, which relays the response back to this window
 * (see app/auth/redirect/page.tsx).
 */
import type { AccountInfo, IPublicClientApplication } from "@azure/msal-browser";
import { config } from "@/lib/config";
import type { User } from "@/lib/types";
import { decodeJwt, toRoles, userFromClaims } from "./jwt";

const MSAL_MESSAGES: Record<string, string> = {
  user_cancelled: "Sign-in was cancelled.",
  popup_window_error: "The sign-in popup was blocked. Allow popups for this site and try again.",
  empty_window_error: "The sign-in popup was blocked. Allow popups for this site and try again.",
  interaction_in_progress: "A sign-in window is already open. Finish or close it, then try again.",
};

function friendlyMsalError(error: unknown): string {
  const code = error && typeof error === "object" && "errorCode" in error ? String(error.errorCode) : "";
  if (MSAL_MESSAGES[code]) return MSAL_MESSAGES[code];
  return error instanceof Error ? error.message : "Microsoft sign-in failed.";
}

let clientPromise: Promise<IPublicClientApplication> | null = null;

function getClient(): Promise<IPublicClientApplication> {
  if (!config.entra.clientId || !config.entra.tenantId) {
    return Promise.reject(
      new Error("Entra sign-in is not configured: set NEXT_PUBLIC_ENTRA_CLIENT_ID and NEXT_PUBLIC_ENTRA_TENANT_ID."),
    );
  }
  clientPromise ??= import("@azure/msal-browser").then(async ({ PublicClientApplication }) => {
    const client = new PublicClientApplication({
      auth: {
        clientId: config.entra.clientId,
        authority: `https://login.microsoftonline.com/${config.entra.tenantId}`,
        redirectUri: `${window.location.origin}/auth/redirect`,
        postLogoutRedirectUri: window.location.origin,
      },
      cache: { cacheLocation: "sessionStorage" },
    });
    await client.initialize();
    // Settles any interaction left over from a previous page (e.g. a popup closed mid-flow),
    // which would otherwise block the next sign-in with "interaction_in_progress".
    await client.handleRedirectPromise().catch(() => null);
    return client;
  });
  return clientPromise;
}

async function acquireToken(account: AccountInfo): Promise<string> {
  const client = await getClient();
  const { InteractionRequiredAuthError } = await import("@azure/msal-browser");
  const request = { scopes: config.entra.scopes, account };
  try {
    return (await client.acquireTokenSilent(request)).accessToken;
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError) {
      return (await client.acquireTokenPopup(request)).accessToken;
    }
    throw error;
  }
}

/** Roles come from the API access token (app roles); the ID token is a fallback. */
async function toUser(account: AccountInfo): Promise<User> {
  const accessClaims = decodeJwt(await acquireToken(account)) ?? {};
  const idClaims = account.idTokenClaims ?? {};
  const roles = toRoles(accessClaims.roles).length ? toRoles(accessClaims.roles) : toRoles(idClaims.roles);
  return userFromClaims({ ...idClaims, ...accessClaims }, { name: account.name ?? undefined, roles });
}

export const entraAuth = {
  /** Restores an existing MSAL session (e.g. after a reload); returns null when signed out. */
  async restore(): Promise<{ user: User; account: AccountInfo } | null> {
    const client = await getClient();
    const account = client.getActiveAccount() ?? client.getAllAccounts()[0];
    if (!account) return null;
    client.setActiveAccount(account);
    return { user: await toUser(account), account };
  },

  async login(): Promise<{ user: User; account: AccountInfo }> {
    const client = await getClient();
    try {
      const result = await client.loginPopup({ scopes: config.entra.scopes, prompt: "select_account" });
      client.setActiveAccount(result.account);
      return { user: await toUser(result.account), account: result.account };
    } catch (error) {
      throw new Error(friendlyMsalError(error));
    }
  },

  tokenProvider(account: AccountInfo) {
    return () => acquireToken(account);
  },

  async logout() {
    const client = await getClient();
    await client.logoutPopup({ account: client.getActiveAccount() ?? undefined });
  },
};
