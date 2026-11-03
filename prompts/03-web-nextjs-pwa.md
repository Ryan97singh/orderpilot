# 03 — Web (Next.js PWA) build prompt

Sent to Claude together with `docs/SPEC.md`. The three layer prompts ran in parallel against the same contract.

```text
Build the `web` front end of a demo app called OrderPilot, in `/Users/ryan/Downloads/Adlertech_AI_App_Developer/orderpilot/web/`. Read the full contract first: `/Users/ryan/Downloads/Adlertech_AI_App_Developer/orderpilot/docs/SPEC.md`. Implement the web parts exactly: pages, env vars, auth modes and PWA. Two other agents are building `core-api/` (Java Spring Boot on :8080, base `/api`) and `ai-service/` (FastAPI on :8000, base `/ai`) at the same time against the same contract. Code against the contract; don't touch their folders or SPEC.md. Write any deviation in `web/README.md` under "Contract notes".

Context: this is an interview demo for an "AI Application Developer" role. The JD must-haves are React, Next.js, TypeScript and PWA (mobile-ready), plus Microsoft Entra ID / MSAL. The interviewer will open the live URL on a laptop and probably a phone, so it must look polished, professional and calm (not flashy):
- mobile-first;
- clear typography;
- a consistent design system (Tailwind + a small set of your own components);
- light and dark mode;
- accessible (labels, focus states, contrast).
Code quality matters, because they will read it.

Stack and requirements:
- Next.js (latest stable, App Router), TypeScript strict, Tailwind CSS. Keep dependencies lean. TanStack Query for server state, and a tiny auth context. A charting library is fine for the dashboard (e.g. recharts).
- API layer `lib/api.ts`:
  - typed fetch wrappers for every endpoint in the spec, with types in `lib/types.ts` matching the spec shapes;
  - attaches `Authorization: Bearer` and `X-Request-Id`;
  - parses RFC 7807 errors into readable messages;
  - shows a "waking up the free server…" banner when a request takes more than 5s (Render free tier sleeps), with retry.
- Auth:
  - `NEXT_PUBLIC_AUTH_MODE=demo` (default): the landing page role picker (Sales Rep / Manager) calls `POST {CORE}/api/auth/demo-login` and stores the token in sessionStorage.
  - `entra`: an MSAL path with `@azure/msal-browser` (`PublicClientApplication`, `loginPopup`, `acquireTokenSilent` with scopes from env).
  - Both behind one `useAuth()` hook. Route guard; MANAGER-only nav for dashboard and approvals.
- Pages, as in the spec:
  - `/` (pitch + role picker);
  - `/chat`:
    - message list with markdown rendering;
    - quote/confirmation card showing the order lines table, promotions, warnings and credit status, with Confirm and Edit buttons (Confirm calls `/ai/chat/confirm`);
    - a placed-order success card linking to `/orders/[id]`;
    - a collapsible "Agent steps" trace showing the `steps` array;
    - citations chips for knowledge answers;
    - suggested prompts such as "Order 20 cases of FizzUp Cola 330ml for Al Noor Grocery", "What is the credit approval policy?" and "Any promotions on Oasis Juice this week?";
  - `/orders` and `/orders/[id]` (approve/cancel for MANAGER, a "Generate AI summary" button);
  - `/catalog` (search, category filter, stock by warehouse);
  - `/knowledge` (search with snippets);
  - `/prompt-studio` (requirement textarea + layer select; shows analysis, a copyable prompt and acceptance criteria);
  - `/dashboard` (KPI cards, revenue-by-day chart, orders by source UI vs AI_AGENT, low stock, top products, pending approvals);
  - `/architecture`: a static, nicely laid-out page for interviewers covering:
    - a system diagram (inline SVG or mermaid rendered at build time; no heavy runtime library if avoidable): Next.js PWA → FastAPI AI service (LangGraph, Claude/Azure OpenAI, Azure AI Search) → Spring Boot core API (Java 21, JPA, Azure SQL) and Entra ID;
    - the request flow for "place order via chat" step by step;
    - the target Azure deployment: Container Apps, Key Vault, Azure SQL, AI Search, Azure OpenAI/Foundry, Entra ID, Static Web Apps;
    - a short "Built with Claude" section explaining the workflow: requirements → structured prompts → generated code → review/tests → iterate, pointing to the repo's `prompts/` folder.
- PWA:
  - `app/manifest.ts` with name, short_name, theme colors and icons (generate simple PNG icons, e.g. 192/512 and a maskable one, with an "OP" monogram; you can render them with a small node script using sharp if needed, or hand-write SVG and convert);
  - a service worker (hand-written `public/sw.js` registered from a client component, or a maintained plugin that works with the current Next.js version), caching the app shell and catalog GET responses network-first with a cache fallback;
  - an offline banner;
  - installable on Android/iOS (apple-touch-icon, meta tags).
- Env: `NEXT_PUBLIC_CORE_API_URL` (default `http://localhost:8080`), `NEXT_PUBLIC_AI_API_URL` (default `http://localhost:8000`), plus the auth envs in the spec. Provide `.env.example`.
- Since the backends may not be running while you work, add a dev-only mock: `NEXT_PUBLIC_USE_MOCKS=true` serves realistic fixture data from `lib/mocks.ts` matching the spec shapes. Use it to visually verify every page. The real deployment uses the real APIs.
- `npm run typecheck`, `npm run lint` and `npm run build` must all pass.
- Dockerfile (Next.js standalone output, node 20/22 alpine, non-root) for Azure Container Apps, and a `vercel.json` only if needed.
- README.md: run commands, env vars, page list, PWA notes.

Verification:
1. Run the dev server (or `next start` after build) with mocks enabled.
2. Use the Playwright MCP browser tools if available (`mcp__playwright__*`; load them with ToolSearch) to visit every page at desktop (1280px) and mobile (390px) widths. Walk the chat order flow (send message → quote card → confirm → success card), the manager approve flow and prompt studio, and check the console for errors.
3. Fix issues you find.
4. Stop the servers you started.

Report back:
- pages built and the components summary;
- build/lint/typecheck results;
- what you verified in the browser and any remaining issues;
- env vars.
Do not create git repos, commit, push or deploy.
```
