# OrderPilot — build spec (shared contract for all three services)

AI sales & ordering copilot for an FMCG beverage distributor (Gulf region, currency AED).
Sales reps use a mobile PWA to chat with an AI agent that looks up outlets, checks stock and
credit, quotes prices with promotions, and places orders after the rep confirms. Managers see a
dashboard. A "Prompt Studio" turns a business requirement into a structured Claude build prompt.

All brands, outlets and people are fictional. Demo data only.

## Services

| Service | Folder | Stack | Local port | Hosting (demo) | Hosting (target) |
|---|---|---|---|---|---|
| core-api | `core-api/` | Java 21, Spring Boot 3.x, Spring Data JPA, Flyway, Spring Security (JWT resource server), Spring AI | 8080 | Render (Docker, free) | Azure Container Apps |
| ai-service | `ai-service/` | Python 3.12, FastAPI, LangGraph, Anthropic SDK / Azure OpenAI, Azure AI Search SDK | 8000 | Vercel (Python runtime) | Azure Container Apps |
| web | `web/` | Next.js (App Router) + TypeScript + Tailwind, PWA, MSAL-ready | 3000 | Vercel | Azure Static Web Apps / Container Apps |

Database: H2 in-memory (demo profile, seeded by Flyway) / PostgreSQL (docker-compose) / Azure SQL (`azure` profile).

## Auth (same in all services)

- `AUTH_MODE=demo` (default): `POST /api/auth/demo-login {"role":"REP"|"MANAGER"}` on core-api returns
  `{"token": "<HS256 JWT>", "user": {...}}`. Claims: `sub`, `name`, `roles` (array: `REP` or `MANAGER`),
  `iss=orderpilot-demo`, `exp` (8h). Secret: env `JWT_SECRET` (shared by core-api and ai-service).
- `AUTH_MODE=entra`: both APIs validate Microsoft Entra ID access tokens (env `ENTRA_TENANT_ID`,
  `ENTRA_AUDIENCE`; issuer `https://login.microsoftonline.com/<tenant>/v2.0`). App roles map to `REP`/`MANAGER`.
  The web app uses `@azure/msal-browser` when `NEXT_PUBLIC_AUTH_MODE=entra`.
- Every request: `Authorization: Bearer <token>`. ai-service forwards the user's token to core-api when it
  calls tools (on-behalf-of the user), so core-api enforces permissions for agent actions too.

## Domain (core-api)

- `Outlet`: id (long), code (e.g. `OUT-1001`), name, channel (`GROCERY`|`HORECA`|`MODERN_TRADE`), city,
  creditLimit, outstandingBalance, salesRepId.
- `Product`: sku (e.g. `FZ-COLA-330-24`), name, brand, category (`CARBONATED`|`JUICE`|`WATER`|`ENERGY`),
  packSize (e.g. "24 x 330ml can"), casePrice (AED), active.
- `Inventory`: sku, warehouse (`DXB`|`AUH`|`SHJ`), onHandCases, reservedCases. Available = onHand - reserved.
- `Promotion`: id, sku, channel (nullable = all), discountPct, minCases, validFrom, validTo, description.
- `SalesOrder`: id, orderNo (`SO-2026-00001`), outletId, status (`PENDING_APPROVAL`|`CONFIRMED`|`DISPATCHED`|`CANCELLED`),
  subtotal, discount, total, source (`UI`|`AI_AGENT`), createdBy, createdAt, notes, aiSummary (nullable).
- `OrderLine`: sku, productName, qtyCases, unitPrice, discountPct, lineTotal.

Seed: ~12 outlets across Dubai/Abu Dhabi/Sharjah, ~15 products across 4 fictional brands
(FizzUp, Oasis Juice, Pure Peak Water, VoltX Energy), inventory in 3 warehouses, ~6 active promotions,
~25 historical orders.

Business rules (quote and order use the same pricing service):
1. Unknown/inactive SKU -> 422 with a clear message.
2. Promotion applies when channel matches (or null) and qty >= minCases and today within validity; take the best one.
3. Stock: available in the outlet's city warehouse (Dubai->DXB, Abu Dhabi->AUH, Sharjah->SHJ). If short,
   the quote returns a warning and `fulfillable=false` for that line; placing such an order is rejected (409).
4. Credit: if outstandingBalance + total > creditLimit, the order is created as `PENDING_APPROVAL`
   (managers approve), otherwise `CONFIRMED`. Confirmed orders reserve stock.
5. Idempotency: `POST /api/orders` accepts header `Idempotency-Key`; a repeated key returns the original order.

## core-api endpoints (all JSON, base `/api`)

| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/api/health` | public | `{"status":"UP","service":"core-api","version":...}` |
| POST | `/api/auth/demo-login` | public (demo mode only) | body `{"role":"REP"}` |
| GET | `/api/me` | any | user from token |
| GET | `/api/outlets?q=` | any | search by name/code/city (case-insensitive contains) |
| GET | `/api/outlets/{id}` | any | includes `availableCredit` |
| GET | `/api/products?q=&category=` | any | search name/brand/sku |
| GET | `/api/products/{sku}` | any | includes stock per warehouse |
| POST | `/api/orders/quote` | REP, MANAGER | body `{"outletId":1,"lines":[{"sku":"...","qtyCases":10}]}` -> `{outlet, lines:[{sku,productName,qtyCases,unitPrice,discountPct,promotion,lineTotal,available,fulfillable}], subtotal, discount, total, creditStatus:"OK"|"NEEDS_APPROVAL", warnings:[]}` |
| POST | `/api/orders` | REP, MANAGER | same body + optional `notes`, `source`; header `Idempotency-Key` |
| GET | `/api/orders?outletId=&status=&page=&size=` | any | newest first; REP sees all in demo |
| GET | `/api/orders/{id}` | any | with lines |
| POST | `/api/orders/{id}/approve` | MANAGER | PENDING_APPROVAL -> CONFIRMED (reserves stock) |
| POST | `/api/orders/{id}/cancel` | REP, MANAGER | releases reserved stock |
| POST | `/api/orders/{id}/ai-summary` | any | Spring AI generates a 3-bullet summary + risk note; stored in `aiSummary` |
| GET | `/api/dashboard/summary` | MANAGER | `{ordersToday, revenueMtd, pendingApprovals, lowStock:[...], topProducts:[...], ordersBySource:{UI,AI_AGENT}, revenueByDay:[{date,total}]}` |

Errors: RFC 7807 `application/problem+json` (`type`, `title`, `status`, `detail`).

## ai-service endpoints (base `/ai`)

| Method | Path | Notes |
|---|---|---|
| GET | `/ai/health` | `{"status":"ok","llm_provider":..., "search_provider":...}` |
| POST | `/ai/chat` | body `{"session_id":"...","messages":[{"role":"user","content":"..."}],"outlet_id":null}` -> `{"reply":"markdown","intent":"ORDER"|"KNOWLEDGE"|"GENERAL","quote":{...}|null,"pending_action":{"type":"PLACE_ORDER","payload":{...}}|null,"order":{...}|null,"citations":[{"doc","title","snippet"}],"steps":[{"node","detail"}]}` |
| POST | `/ai/chat/confirm` | body `{"session_id":"...","pending_action":{...}}` -> places the order via core-api (Idempotency-Key = session_id + hash) and returns `{"reply","order"}` |
| POST | `/ai/knowledge/search` | `{"query":"...","top_k":4}` -> hits with doc, title, snippet, score |
| POST | `/ai/prompt-studio` | `{"requirement":"business text","layer":"backend"|"frontend"|"ai"|"fullstack"}` -> `{"analysis":{actors, entities, rules, open_questions}, "prompt":"structured Claude prompt (markdown)", "acceptance_criteria":[...]}` |

LangGraph agent (`/ai/chat`): `classify_intent` -> ORDER branch: `extract_order` (LLM structured output:
outlet reference + lines of product reference + qty) -> `resolve_entities` (tools: search outlets/products on
core-api) -> `quote` (tool: POST /orders/quote) -> `propose` (returns a confirmation card; NEVER places the order
itself — human-in-the-loop). KNOWLEDGE branch: `retrieve` (search provider) -> `answer_with_citations`.
GENERAL branch: short helpful answer. Each node appends to `steps` so the UI can show the trace.

Providers (env-selected, with fallbacks):
- LLM: `LLM_PROVIDER=claude|azure_openai|mock`. Claude via official `anthropic` SDK (`ANTHROPIC_API_KEY`,
  model env `CLAUDE_MODEL`, default `claude-sonnet-5-5`). Azure OpenAI via `openai` SDK `AzureOpenAI`
  (`AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_DEPLOYMENT`, `AZURE_OPENAI_API_VERSION`).
  `mock` is deterministic (regex extraction) so the whole demo works with no key, and tests use it.
  `LLM_DAILY_BUDGET_USD` (default 1): when exceeded, fall back to mock and say so in `steps`.
- Search: `SEARCH_PROVIDER=azure_ai_search|local`. Azure via `azure-search-documents`
  (`AZURE_SEARCH_ENDPOINT`, `AZURE_SEARCH_KEY`, `AZURE_SEARCH_INDEX`); local = BM25 over `ai-service/knowledge/*.md`
  (credit policy, promotion rules, returns policy, product guide, delivery schedule, new-outlet onboarding).

## web (Next.js PWA)

Env: `NEXT_PUBLIC_CORE_API_URL`, `NEXT_PUBLIC_AI_API_URL`, `NEXT_PUBLIC_AUTH_MODE=demo|entra`,
`NEXT_PUBLIC_ENTRA_CLIENT_ID`, `NEXT_PUBLIC_ENTRA_TENANT_ID`.

Pages: `/` landing + role picker (Sales Rep / Manager) · `/chat` agent chat with confirmation cards and a
collapsible "agent steps" trace · `/orders` list + `/orders/[id]` detail (approve/cancel, "Generate AI summary")
· `/catalog` products with stock · `/knowledge` search · `/prompt-studio` · `/dashboard` (manager KPIs, charts)
· `/architecture` (diagram + how it was built with Claude, for interviewers).
Mobile-first, installable PWA (manifest, icons, service worker caching the app shell and catalog GETs,
offline banner). Cold-start banner if an API takes >5s (free hosting sleeps).

## Cross-cutting

- Health endpoints, structured JSON logs, request IDs (`X-Request-Id` propagated web -> ai -> core).
- CORS: env `CORS_ORIGINS` (comma-separated).
- Tests: core-api JUnit 5 + Spring Boot tests (pricing, credit, idempotency, security); ai-service pytest with
  mock LLM + mocked core-api (respx); web: typecheck + lint + build.
- Docker: one Dockerfile per service; `docker-compose.yml` at repo root (postgres + 3 services).
