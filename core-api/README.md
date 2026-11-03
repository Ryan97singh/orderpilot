# OrderPilot core-api

Java 21 + Spring Boot 3.5 service behind OrderPilot. It holds outlets, the product catalog with stock, pricing with
promotions, credit-aware ordering, and AI order summaries. It is a stateless JWT resource server: demo HS256 tokens or
Microsoft Entra ID.

| | |
|---|---|
| Runtime | OpenJDK 21, Spring Boot 3.5.16 (virtual threads on) |
| Data | Spring Data JPA (Hibernate 6), Flyway; H2 (demo), PostgreSQL, Azure SQL |
| Security | Spring Security OAuth2 resource server, `@PreAuthorize` role checks, CORS from env |
| AI | Spring AI 1.1.8 `ChatClient`: Anthropic Claude or Azure OpenAI, template fallback |
| API | REST + RFC 7807 `application/problem+json`, OpenAPI at `/swagger-ui.html` |
| Ops | ECS JSON logs, `X-Request-Id` propagation, actuator health/probes, 512 MB-friendly Docker image |

## Run

```bash
# demo profile (default): in-memory H2 seeded by Flyway, demo auth, mock LLM, no keys needed
./mvnw spring-boot:run

# tests (unit + Spring Boot integration)
./mvnw verify

# PostgreSQL
docker run -d --name op-pg -e POSTGRES_USER=orderpilot -e POSTGRES_PASSWORD=orderpilot \
  -e POSTGRES_DB=orderpilot -p 5432:5432 postgres:16-alpine
SPRING_PROFILES_ACTIVE=postgres DATABASE_URL=jdbc:postgresql://localhost:5432/orderpilot \
  DB_USER=orderpilot DB_PASSWORD=orderpilot ./mvnw spring-boot:run

# Claude summaries
LLM_PROVIDER=claude ANTHROPIC_API_KEY=sk-ant-... ./mvnw spring-boot:run

# Docker (multi-stage, layered jar, non-root, honours PORT)
docker build -t orderpilot-core-api .
docker run --rm -p 8080:8080 -m 512m orderpilot-core-api
```

Try it:

```bash
TOKEN=$(curl -s -X POST localhost:8080/api/auth/demo-login -H 'Content-Type: application/json' \
  -d '{"role":"REP"}' | jq -r .token)
curl -s localhost:8080/api/orders/quote -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"outletId":1,"lines":[{"sku":"FZ-COLA-330-24","qtyCases":30}]}' | jq
```

Swagger UI: http://localhost:8080/swagger-ui.html (call demo-login, then **Authorize** with the token).

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `8080` | HTTP port (`server.port=${PORT:8080}`) |
| `SPRING_PROFILES_ACTIVE` | `demo` | `demo` (H2), `postgres`, or `azure` (Azure SQL) |
| `AUTH_MODE` | `demo` | `demo` = HS256 tokens from `/api/auth/demo-login`; `entra` = Microsoft Entra ID |
| `JWT_SECRET` | `orderpilot-dev-secret-change-me-please-32b` | HS256 secret, at least 32 bytes; shared with ai-service |
| `ENTRA_TENANT_ID` | – | Entra tenant; issuer is `https://login.microsoftonline.com/<tenant>/v2.0` |
| `ENTRA_AUDIENCE` | – | Required `aud` claim, e.g. `api://orderpilot-core` (both required when `AUTH_MODE=entra`) |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated origins; patterns allowed (`https://*.vercel.app`) |
| `LLM_PROVIDER` | `mock` | `claude`, `azure_openai` or `mock` |
| `ANTHROPIC_API_KEY` | – | Needed for `claude`; without it the service falls back to `mock` |
| `CLAUDE_MODEL` | `claude-sonnet-5-5` | Anthropic model id |
| `AZURE_OPENAI_ENDPOINT` | – | e.g. `https://<resource>.openai.azure.com/` |
| `AZURE_OPENAI_API_KEY` | – | Azure OpenAI key |
| `AZURE_OPENAI_DEPLOYMENT` | `gpt-4o-mini` | Azure OpenAI deployment name |
| `DATABASE_URL` | `jdbc:postgresql://localhost:5432/orderpilot` | `postgres` profile; **JDBC form** (not `postgres://…`) |
| `DB_USER` / `DB_PASSWORD` | `orderpilot` / `orderpilot` | `postgres` profile |
| `AZURE_SQL_URL` | – | `azure` profile, e.g. `jdbc:sqlserver://<srv>.database.windows.net:1433;database=orderpilot;encrypt=true` |
| `AZURE_SQL_USER` / `AZURE_SQL_PASSWORD` | – | `azure` profile; the password comes from Key Vault via a Container App secret reference |
| `LOG_FORMAT` | `ecs` | Structured console logs (`ecs`, `logstash`, `gelf`); set it empty for plain text locally |
| `JAVA_OPTS` | `-XX:MaxRAMPercentage=70 -XX:+UseSerialGC -Xss512k` | JVM flags in the Docker image |

## Endpoints

All under `/api`, JSON. Roles come from the token's `roles` claim.

| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/api/health` | public | `{"status":"UP","service":"core-api","version":…,"authMode":…,"llmProvider":…}` |
| POST | `/api/auth/demo-login` | public, demo mode only | `{"role":"REP"\|"MANAGER"}` → `{token, tokenType, expiresAt, user}` |
| GET | `/api/me` | any | `{id, name, email, roles}` |
| GET | `/api/outlets?q=` | any | name/code/city, case-insensitive contains |
| GET | `/api/outlets/{id}` | any | includes `availableCredit` and `warehouse` |
| GET | `/api/products?q=&category=` | any | active products by name/brand/SKU; includes `stock` and today's `promotions` |
| GET | `/api/products/{sku}` | any | stock per warehouse (`onHandCases`, `reservedCases`, `availableCases`) |
| POST | `/api/orders/quote` | REP, MANAGER | prices, best promotion, stock in the outlet's warehouse, `creditStatus`, `warnings` |
| POST | `/api/orders` | REP, MANAGER | `Idempotency-Key` header; 201 + `Location`, or 200 + `Idempotent-Replayed: true` on replay |
| GET | `/api/orders?outletId=&status=&page=&size=` | any | newest first; `{content, number, size, totalElements, totalPages}`, `page` zero-based, `size` ≤ 100 |
| GET | `/api/orders/{id}` | any | with `lines` |
| POST | `/api/orders/{id}/approve` | MANAGER | PENDING_APPROVAL → CONFIRMED, reserves stock (409 if stock is now short) |
| POST | `/api/orders/{id}/cancel` | REP, MANAGER | from PENDING_APPROVAL or CONFIRMED; releases reserved stock |
| POST | `/api/orders/{id}/ai-summary` | any | 3 bullets + `Risk:` line, stored in `aiSummary`; returns the order |
| GET | `/api/dashboard/summary` | MANAGER | KPIs (see below) |
| GET | `/actuator/health` (`/liveness`, `/readiness`) | public | platform probes |
| GET | `/swagger-ui.html`, `/v3/api-docs` | public | OpenAPI |

Errors are RFC 7807 problems: `type` (`https://orderpilot.example/problems/<code>`), `title`, `status`, `detail`,
`instance`, plus `code` and `requestId`. Examples are `invalid-sku` (422), `insufficient-stock` (409, with
`shortfalls`), `invalid-order-state` (409), `validation-failed` (400, with `errors`), `unauthorized` (401) and
`forbidden` (403).

## Business rules

The pricing rules live in `service/PricingService`; credit, stock and idempotency are applied in `service/OrderService`.

1. Every SKU must exist and be active, otherwise **422** listing `unknownSkus` / `inactiveSkus`.
2. A promotion applies when its channel matches (or is null), qty ≥ `minCases`, and today (Asia/Dubai) falls within
   `validFrom..validTo`, both days inclusive. The highest `discountPct` wins.
3. Stock is checked in the outlet's city warehouse (Dubai→DXB, Abu Dhabi→AUH, Sharjah→SHJ). A short line gets
   `fulfillable=false` and a warning on the quote; placing that order is **409**.
4. If `outstandingBalance + total > creditLimit`, the order is created `PENDING_APPROVAL`; otherwise it is
   `CONFIRMED`. Only confirmed orders reserve stock. Reservations use optimistic locking (`@Version`).
5. A repeated `Idempotency-Key` returns the original order. A unique index closes the race between concurrent
   duplicates, and the loser returns the winner's order.

Dashboard: `ordersToday` (non-cancelled), `revenueMtd`, `revenueByDay` (last 14 days) and `topProducts` (top 5, last
30 days) count CONFIRMED + DISPATCHED. `ordersBySource` covers non-cancelled orders in the last 30 days.
`lowStock` lists available stock below 50 cases.

## Seed data

`db/migration/postgresql` (H2 + PostgreSQL) and `db/migration/sqlserver` (T-SQL) each have `V1__schema.sql` and
`V2__seed_demo_data.sql`. The seed is fictional:

- 12 outlets in Dubai, Abu Dhabi and Sharjah, some close to their credit limit, e.g. OUT-1005 Karama Corner.
- 16 products across FizzUp, Oasis Juice, Pure Peak Water and VoltX Energy. One is inactive (`FZ-LEMN-330-24`).
- 48 inventory rows. A few are deliberately low, e.g. `VX-TROP-500-12` has 8 cases in SHJ.
- 6 active promotions, plus one expired and one upcoming.
- 25 historical orders over the last 30 days, with a mix of statuses and sources.

Both migration sets have been run end to end: on H2 (demo), PostgreSQL 16, and the SQL Server engine via Azure SQL
Edge. All dates are relative to the migration date, so the dashboard always looks current. Order totals in the seed are
computed with the same pricing rules.

## Java 21 and Spring features used

- **Records** for every DTO, command and query projection (`QuoteResponse`, `PlaceOrderCommand`,
  `SalesOrderRepository.ProductSales`, `AppProperties`).
- **Sealed hierarchies + exhaustive pattern-matching `switch`:**
  - `DomainException` permits `NotFoundException` / `RuleViolationException` / `ConflictException`, mapped to
    404/422/409 in `GlobalExceptionHandler`.
  - `CreditDecision` (`WithinLimit` | `ExceedsLimit`).
  - `SummaryResult` (`Generated` | `Template`).
- **Record patterns:** `credit instanceof CreditDecision.ExceedsLimit(var over)`.
- **Switch expressions** for `Warehouse.forCity` and `SalesOrder.cancel()` state transitions.
- **Text blocks** for JPQL and LLM prompts; `String.formatted`; `List.getFirst()` (sequenced collections).
- **Virtual threads** (`spring.threads.virtual.enabled=true`): Tomcat handlers run as `tomcat-handler-N` virtual
  threads.
- Constructor injection only; `@ConfigurationProperties` bound to a validated record; SLF4J fluent API with
  key/values for structured logs.

## Design notes

- **Spring AI wiring.** `LlmProviderEnvironmentPostProcessor` maps `LLM_PROVIDER` onto Spring AI's
  `spring.ai.model.chat` (`anthropic` | `azure-openai` | `none`). Only one chat model is ever created. A provider
  without credentials degrades to `none`, so the app always starts. `OrderSummaryService` builds a `ChatClient` only
  if a `ChatModel` bean exists. The LLM call runs outside any DB transaction. Any failure is logged and the
  deterministic template is used instead.
- **Entra ID.** With `AUTH_MODE=entra`, Spring Boot's resource-server auto-configuration builds the decoder from
  `spring.security.oauth2.resourceserver.jwt.issuer-uri` (from `ENTRA_TENANT_ID`) and validates `audiences`
  (`ENTRA_AUDIENCE`). The JWKS is fetched lazily. App roles in `roles` (`REP`, `MANAGER`, or namespaced like
  `OrderPilot.Manager`) map to `ROLE_*`. In demo mode an HS256 `NimbusJwtDecoder` checks signature, expiry and
  `iss=orderpilot-demo`.
- **Order numbers** come from the `order_no_seq` sequence. The Hibernate dialect renders the right "next value" SQL
  for each database.
- **Memory.** Serial GC, a 70% heap cap, a small thread stack and virtual threads keep the container well under
  512 MB.

## Contract notes

Places where `docs/SPEC.md` leaves the shape open, or where core-api adds to it. Extra fields are additive; nothing
in the spec was removed or renamed.

1. **`promotion` on quote lines** is the full promotion object
   `{id, sku, channel, discountPct, minCases, validFrom, validTo, description}`, or `null` when none applies.
2. **Quote** also returns top-level `fulfillable`, and `warehouse` on each line.
3. **Repeated SKUs** in one request are merged into one line (quantities summed) before promotions and stock are
   checked. SKUs are matched case-insensitively.
4. **`GET /api/orders`** returns `{content, number, size, totalElements, totalPages}` (zero-based `page`, default
   size 20, max 100). List items omit `lines`; they include `outletCode` and `outletName`.
5. **Order JSON** exposes `outletId`, plus `outletCode` and `outletName` for display.
6. **`POST /api/orders`** returns **201** with `Location` for a new order. An idempotent replay returns **200** with
   `Idempotent-Replayed: true` and the original body. The order's `createdBy` is the token's user id (`sub`, or
   `oid` under Entra).
7. **`POST /api/orders/{id}/ai-summary`** returns the updated order (the text is in `aiSummary`).
8. **Approve** re-checks stock. If stock ran out since the order was placed, approval is **409
   `insufficient-stock`** and the order stays pending.
9. **Dashboard** item shapes:
   - `lowStock[]`: `{sku, productName, warehouse, availableCases, onHandCases, reservedCases}`.
   - `topProducts[]`: `{sku, productName, qtyCases, revenue}`.
   - `revenueByDay`: 14 consecutive days (zeros included).
   - Also returns `asOf` and `currency`.
10. **Products list** shows active products only. `GET /api/products/{sku}` also returns inactive ones
    (`active:false`).
11. **Demo login** response also has `tokenType` and `expiresAt`. Users are `rep-001` (Aisha Rahman, REP) and
    `mgr-001` (Omar Haddad, MANAGER). Demo tokens carry no `aud` claim.
12. **Outlet** JSON also includes `warehouse` (derived from city). `salesRepId` is a string (`rep-001`…).
13. **Health** also reports `authMode` and the effective `llmProvider`.
14. **Azure OpenAI API version** is chosen by the Azure SDK that Spring AI uses. `AZURE_OPENAI_API_VERSION` is only
    read by ai-service.
