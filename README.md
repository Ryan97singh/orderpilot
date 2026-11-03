# OrderPilot: AI sales & ordering copilot

An AI copilot for the field sales team of an FMCG beverage distributor. A sales rep types an order the way
they would text it ("20 cases of FizzUp Cola for Al Noor Grocery") into a mobile PWA. An AI agent finds
the outlet and products, checks stock and credit, applies promotions and shows a quote. The order is only
placed when the rep confirms. Managers approve over-limit orders, read AI order summaries and watch a KPI
dashboard. Policy questions are answered from company documents with citations.

Built with Claude as the primary development tool. The actual prompts are in [`prompts/`](prompts/).

**Live demo:** see the links at the top of [`docs/LIVE.md`](docs/LIVE.md). It runs on free hosting, so the
first request after a while can take ~1 minute while the Java API wakes up.

## Architecture

```
 Next.js PWA (React, TypeScript)  ── MSAL / demo login
        │ Bearer token + X-Request-Id
        ├──────────────► FastAPI AI service (Python)
        │                 ├─ LangGraph agent: classify → extract → resolve → quote → propose (human confirms)
        │                 ├─ LLM: Claude (Anthropic SDK) | Azure OpenAI | mock, with daily budget cap
        │                 ├─ Search: Azure AI Search | local BM25 over policy docs
        │                 └─ calls the core API as tools, on behalf of the user
        └──────────────► Spring Boot core API (Java 21)
                          ├─ JPA entities, Flyway migrations (H2 demo / PostgreSQL / Azure SQL)
                          ├─ pricing, promotions, stock, credit approval, idempotent orders
                          ├─ Spring Security: demo HS256 JWT | Microsoft Entra ID
                          └─ Spring AI order summaries (Claude | Azure OpenAI)
```

| Folder | What | Stack |
|---|---|---|
| [`core-api/`](core-api/) | Business logic and REST API | Java 21, Spring Boot 3.5, Spring Data JPA, Flyway, Spring Security, Spring AI |
| [`ai-service/`](ai-service/) | AI agent, retrieval, Prompt Studio | Python 3.12, FastAPI, LangGraph, Anthropic SDK, Azure OpenAI, Azure AI Search |
| [`web/`](web/) | Mobile-first installable PWA | Next.js (App Router), React 19, TypeScript, Tailwind, TanStack Query, MSAL |
| [`infra/azure/`](infra/azure/) | Target Azure deployment | Bicep: Container Apps, Azure SQL, AI Search, Azure OpenAI, Key Vault, managed identity |
| [`prompts/`](prompts/) | How it was built with Claude | Requirement analysis, shared contract, per-layer build prompts, review prompts |
| [`docs/SPEC.md`](docs/SPEC.md) | The shared contract all three services implement | |

## Run locally

```bash
docker compose up --build          # web :3000, core-api :8080 (Swagger /swagger-ui.html), ai-service :8000
```

Or run each service on its own (see each folder's README). Everything works offline with `LLM_PROVIDER=mock`;
set `LLM_PROVIDER=claude` and `ANTHROPIC_API_KEY` for real model calls.

## Tests

- core-api: `./mvnw verify` (55 tests: pricing, credit, idempotency, security, end-to-end on H2)
- ai-service: `pytest` (21 tests: agent order flow, confirmation, auth, retrieval, budget fallback)
- web: `npm run typecheck && npm run lint && npm run build`

CI runs all three plus a Bicep compile on every push ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)).

## Hosting

| Environment | Web | AI service | Core API | Database |
|---|---|---|---|---|
| Demo (free) | Vercel | Vercel (Python) | Render (Docker) | H2 in memory, seeded on start |
| Target (Azure) | Container Apps | Container Apps | Container Apps | Azure SQL |

Secrets are never in the repo: on Azure they live in Key Vault and are read through a managed identity;
on the demo hosts they are set in the provider's environment settings.

All brands, outlets and people in the demo data are fictional.
