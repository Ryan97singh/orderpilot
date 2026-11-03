# OrderPilot: web

Mobile-first, installable PWA for OrderPilot, the AI sales and ordering copilot. Sales reps chat with an AI agent to
quote and place orders; managers get a dashboard and an approvals queue. Built against the shared contract in
[`../docs/SPEC.md`](../docs/SPEC.md).

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4 · TanStack Query ·
`@azure/msal-browser` (Entra ID) · Recharts (dashboard only, lazy-loaded) · hand-written service worker.

## Run it

```bash
npm install
cp .env.example .env.local        # adjust API URLs if needed

npm run dev:mock                  # http://localhost:3000 with fixture data, no backends needed
npm run dev                       # against core-api (:8080) and ai-service (:8000)

npm run typecheck                 # next typegen && tsc --noEmit
npm run lint                      # eslint (next core-web-vitals + typescript)
npm run build && npm start        # production build; the service worker only registers here
```

Docker (Next.js standalone output, Node 22 Alpine, non-root user), e.g. for Azure Container Apps:

```bash
docker build -t orderpilot-web \
  --build-arg NEXT_PUBLIC_CORE_API_URL=https://<core-api-host> \
  --build-arg NEXT_PUBLIC_AI_API_URL=https://<ai-service-host> .
docker run -p 3000:3000 orderpilot-web
```

On Vercel no extra config is needed (no `vercel.json`); set the env vars in the project settings.

## Environment variables

All variables are `NEXT_PUBLIC_*`, so they are **inlined at build time**: change them and rebuild.

| Variable | Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_CORE_API_URL` | `http://localhost:8080` | core-api base URL (serves `/api/*`) |
| `NEXT_PUBLIC_AI_API_URL` | `http://localhost:8000` | ai-service base URL (serves `/ai/*`) |
| `NEXT_PUBLIC_AUTH_MODE` | `demo` | `demo` = role picker + `POST /api/auth/demo-login`; `entra` = Microsoft Entra ID via MSAL |
| `NEXT_PUBLIC_ENTRA_CLIENT_ID` | (none) | SPA app registration (client) ID, entra mode |
| `NEXT_PUBLIC_ENTRA_TENANT_ID` | (none) | Directory (tenant) ID, entra mode |
| `NEXT_PUBLIC_ENTRA_SCOPES` | `api://<client-id>/access_as_user` | API scopes for `acquireTokenSilent` (space/comma separated) |
| `NEXT_PUBLIC_USE_MOCKS` | `false` | **Dev only.** Serve fixture data from `lib/mocks.ts` |
| `NEXT_PUBLIC_MOCK_LATENCY_MS` | `450` | **Dev only.** Simulated mock latency; >5000 previews the cold-start banner |

## Pages

| Route | Who | What |
|---|---|---|
| `/` | everyone | Pitch, live API status (also wakes sleeping free-tier servers), role picker or Microsoft sign-in |
| `/chat` | REP, MANAGER | Agent chat: markdown replies, quote/confirmation card (lines, promotions, warnings, credit status, **Confirm** / **Edit**), order-placed card, citation chips, collapsible "Agent steps" trace, suggested prompts, optional outlet context |
| `/orders` | REP, MANAGER | Order list with status filters and pagination |
| `/orders/[id]` | REP, MANAGER | Lines and totals, outlet credit meter, **Approve** (manager), **Cancel** (with confirm dialog), **Generate AI summary** |
| `/approvals` | MANAGER | Pending-approval queue with one-tap approve (nav badge shows the count) |
| `/catalog` | REP, MANAGER | Search, category filter, stock per warehouse (DXB/AUH/SHJ) on demand; cached for offline |
| `/knowledge` | REP, MANAGER | Policy search with highlighted snippets and source documents |
| `/prompt-studio` | REP, MANAGER | Requirement + layer → analysis, copyable structured Claude prompt, acceptance criteria |
| `/dashboard` | MANAGER | KPI cards, revenue-by-day chart (with data table), AI vs UI order split, top products, low stock, pending approvals |
| `/architecture` | public | For interviewers: system diagram (inline SVG), chat-order request flow, Azure target, "Built with Claude" |
| `/offline`, `/auth/redirect` | n/a | Service-worker offline fallback; MSAL v5 popup redirect bridge |

Role checks in the UI are for UX only. The APIs enforce roles on every call.

## Project layout

```
app/                     routes; (app)/ is the signed-in shell with the route guard
  manifest.ts            PWA manifest
components/ui/           design system: Button, Card, Badge, Field/Input/Select/Textarea, Alert,
                         ErrorState, EmptyState, Skeleton, ConfirmDialog (<dialog>), Markdown, PageHeader
components/chat/         QuoteCard, OrderPlacedCard, AgentSteps, Citations, useChat
components/              AppShell (sidebar + mobile tab bar + menu sheet), RequireAuth, banners, theme toggle
lib/api.ts               typed fetch wrappers for every endpoint in the spec
lib/types.ts             request/response types mirroring the spec
lib/auth/                useAuth() context, session store, demo + Entra (MSAL) implementations
lib/mocks.ts             dev-only in-browser backend with the spec's business rules
public/sw.js             service worker
scripts/generate-icons.mjs  renders the "OP" icon set with sharp (npm run icons)
```

## How the API layer works

- **Headers:** every call sends `Authorization: Bearer <token>` (demo JWT or Entra access token) and a fresh
  `X-Request-Id` (UUID), so a request can be traced web → ai-service → core-api.
- **Errors:** non-2xx responses are parsed as RFC 7807 problem details (and FastAPI's `{detail}` shape) into an
  `ApiError` with a human-readable `message`. A 401 signs the user out and returns them to `/?expired=1`.
- **Cold starts:** a request taking more than 5s raises the global "Waking up the free server…" banner; a request
  that never reaches the server shows a "Couldn't reach the server" banner with **Retry**, which refetches active queries.
  Every list/detail view also has its own error state with Retry. Requests time out after 90s.
- **Server state:** TanStack Query. Mutations (confirm, approve, cancel) invalidate orders, dashboard and stock.

## Auth

`useAuth()` exposes `status`, `user`, `isManager`, `login(role?)` and `logout()` for both modes.

- **demo:** `POST {CORE}/api/auth/demo-login {"role":"REP"|"MANAGER"}`. The token and user are stored in
  `sessionStorage` (cleared when the tab closes; restored on reload until the JWT `exp`).
- **entra:** `PublicClientApplication` → `loginPopup` → `acquireTokenSilent` (falls back to `acquireTokenPopup` when
  interaction is required) with `NEXT_PUBLIC_ENTRA_SCOPES`. Roles come from the access token's `roles` claim (app
  roles containing `REP` / `MANAGER`), falling back to the ID token. MSAL is dynamically imported, so demo mode
  doesn't download it.
  Entra setup: register a SPA with redirect URI `https://<host>/auth/redirect`, expose an API scope
  (`access_as_user`), and define app roles `REP` and `MANAGER`.

## PWA notes

- `app/manifest.ts`: name, short name, `standalone` display, theme colours, 192/512 icons plus a 512 maskable icon,
  shortcuts. `app/icon.svg` and `app/apple-icon.png` give the favicon and iOS home-screen icon; `appleWebApp`
  metadata enables iOS standalone mode.
- `public/sw.js` (registered in production builds only):
  - precaches the shell (`/`, `/offline`, manifest, icons);
  - **network-first** for page navigations (fallback: cached page, then `/offline`);
  - **cache-first** for hashed `/_next/static` assets;
  - **network-first with cache fallback** for catalog GETs (`/api/products…`).

  Orders, chat and auth always hit the network. It is served with `Cache-Control: no-cache` so updates roll out.
- An offline banner appears whenever the browser loses connectivity.
- Installability needs HTTPS (Vercel / Static Web Apps provide it; `localhost` also counts).

## Design system

Semantic colour tokens (`bg-surface`, `text-muted`, `border-border`, `bg-primary-soft`, `text-success` …) are defined
once in `app/globals.css` for light and dark mode, so components never use raw palette colours. The theme follows the
OS and can be pinned with the toggle (stored in `localStorage` and applied by an inline script before first paint).
Accessibility: visible focus rings everywhere, labelled form controls, `aria-current` navigation, live regions for
chat and search results, status shown by text and not by colour alone, a skip link, and respect for `prefers-reduced-motion`.

## Contract notes

Where `docs/SPEC.md` leaves a shape open, the web app makes these assumptions. Each one is normalised in one place
(`lib/api.ts`) so it is easy to adjust:

1. **`GET /api/orders` pagination:** accepts either a Spring Data `Page` (`content`, `number`, `size`,
   `totalElements`, `totalPages`) or a plain array.
2. **Order list outlet name:** `SalesOrder` in the spec has only `outletId`. The UI shows `outletName` if present,
   otherwise resolves names via `GET /api/outlets` (no `q`, expected to return all outlets).
3. **`GET /api/products/{sku}` stock:** read from `stock` (or `inventory` / `stockByWarehouse`) as an array of
   `{warehouse, onHandCases, reservedCases, availableCases?}`; available is computed as on-hand minus reserved if missing.
4. **Quote line `promotion`:** accepted as a `Promotion` object (its `description` is shown) or a plain string.
5. **Dashboard `lowStock` / `topProducts` items:** expected `{sku, productName|name, warehouse, availableCases|available}`
   and `{sku, productName|name, qtyCases, revenue}`. `pendingApprovals` is a count; the list comes from
   `GET /api/orders?status=PENDING_APPROVAL`.
6. **`POST /ai/knowledge/search` response:** accepts a bare array of hits or `{hits: [...]}` / `{results: [...]}`.
7. **`POST /api/orders/{id}/ai-summary` response:** any 2xx; the UI refetches the order to show `aiSummary`.
8. **Demo-login `user`:** any missing fields (`id`, `name`, `roles`) are filled from the JWT claims (`sub`, `name`, `roles`).
9. **Extra env var:** `NEXT_PUBLIC_ENTRA_SCOPES` (not in the spec) configures the MSAL scopes; the default is
   `api://<client-id>/access_as_user`.
10. **Extra route:** `/approvals` (manager approval queue) in addition to the spec's page list.
11. **Agent context:** `outlet_id` in `POST /ai/chat` is set from an optional "outlet context" selector in the chat
    header (null by default, so the agent detects the outlet from the message).
12. **CORS:** both APIs must allow the web origin plus the `Authorization`, `Content-Type` and `X-Request-Id` request
    headers (ai-service sets `Idempotency-Key` itself when it calls core-api).

Implementation note: Next.js 16's `cacheComponents` is intentionally **off**. Every page is a client-rendered view
over a bearer-token API, so there is no server data to cache, and the flag would require Suspense boundaries around
the auth-gated segments.
