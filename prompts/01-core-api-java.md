# 01 — Core API (Java 21 / Spring Boot) build prompt

Sent to Claude together with `docs/SPEC.md`. The three layer prompts ran in parallel against the same contract.

```text
Build the `core-api` service of a demo app called OrderPilot, in `/Users/ryan/Downloads/Adlertech_AI_App_Developer/orderpilot/core-api/`. Read the full contract first: `/Users/ryan/Downloads/Adlertech_AI_App_Developer/orderpilot/docs/SPEC.md`. Implement exactly the core-api parts of it: domain, seed data, business rules, endpoints, auth and errors. Two other agents are building `ai-service/` (Python) and `web/` (Next.js) against the same contract at the same time. Do not touch their folders, and do not change SPEC.md. If you must deviate from the contract, write the deviation clearly in `core-api/README.md` under "Contract notes".

Context: this is an interview demo for an "AI Application Developer" role. It must show **Java 21 (OpenJDK 21) + Spring Boot 3.x**, Spring Data JPA entities and Flyway migrations (Azure SQL in prod), REST APIs, Spring Security with JWT (demo HS256 + Microsoft Entra ID ready), and **Spring AI**. Interviewers will read the code, so make it clean, idiomatic and modern Java 21:
- records for DTOs;
- sealed interfaces / pattern matching where natural;
- virtual threads enabled (`spring.threads.virtual.enabled=true`);
- constructor injection;
- a layered package structure (`api`, `domain`, `service`, `repository`, `security`, `ai`, `config`);
- validation with Jakarta Bean Validation;
- RFC 7807 ProblemDetail errors;
- OpenAPI via springdoc (`/swagger-ui.html`).
Keep comments sparse and meaningful.

Environment:
- macOS arm64. OpenJDK 21 is at `/opt/homebrew/Cellar/openjdk@21/21.0.10/libexec/openjdk.jdk/Contents/Home`.
- Maven is NOT installed. Use the Maven Wrapper (`mvnw`, `.mvn/wrapper`). Generate it however works, e.g. download the wrapper files, or temporarily fetch a Maven distribution into a temp folder to run `mvn wrapper:wrapper`. Commit `mvnw` and `.mvn/` into the folder.
- Docker is available.
- Network access for dependency download is available.

Requirements and details:
- Build: Maven, Spring Boot 3.4.x or newer stable, Java 21.
- Profiles:
  - `demo`, the default: H2 in-memory in PostgreSQL compatibility mode, Flyway seeds the data.
  - `postgres`: env `DATABASE_URL`, `DB_USER`, `DB_PASSWORD`.
  - `azure`: Azure SQL (`com.microsoft.sqlserver:mssql-jdbc`), env vars for the JDBC URL/user/password, and a comment that the password should come from Azure Key Vault via the Container App secret reference.
- Flyway migrations: write SQL that runs on H2 (PostgreSQL mode) and PostgreSQL. Add a separate `db/migration/sqlserver` location for the azure profile with the T-SQL schema (seed can be shared if portable; otherwise duplicate). At minimum V1 schema and V2 seed.
- Seed data: fictional brands and outlets, as in the spec. Make order history and promotions realistic so the dashboard looks alive. Dates: compute relative to "now" if possible, or seed dates in Oct–Nov 2026. Today is 2026-11-03.
- Pricing, credit and stock rules and idempotency exactly as in the spec. Put them in a `PricingService` and `OrderService` with unit tests.
- Security:
  - `AUTH_MODE=demo|entra`.
  - Demo: issue and validate HS256 JWTs with `JWT_SECRET` (default dev secret if unset, at least 32 bytes) using `NimbusJwtEncoder`/`NimbusJwtDecoder`.
  - Entra: `spring.security.oauth2.resourceserver.jwt.issuer-uri` from `ENTRA_TENANT_ID`, audience check from `ENTRA_AUDIENCE`, with `roles` claim mapping to authorities.
  - Role checks with `@PreAuthorize`.
  - CORS from env `CORS_ORIGINS`.
  - `/api/health`, `/api/auth/demo-login`, swagger and actuator health are public.
- Spring AI:
  - `POST /api/orders/{id}/ai-summary` uses Spring AI `ChatClient`.
  - Support Anthropic (Spring AI Anthropic starter, `ANTHROPIC_API_KEY`, model from env `CLAUDE_MODEL`, default `claude-sonnet-5-5`) and Azure OpenAI (Spring AI Azure OpenAI starter, env-configured), chosen by `LLM_PROVIDER=claude|azure_openai|mock`.
  - If no key, or `mock`, return a deterministic template summary.
  - Never fail the request because the LLM failed; fall back to the template and log it.
  - Make sure the app starts with no AI keys at all. Disable the auto-configs that would fail without keys, or wire `ChatClient` beans conditionally.
  - Use a Spring AI version that is compatible with your Spring Boot version, and check it actually resolves.
- Observability: JSON-ish structured logs, plus an `X-Request-Id` filter that propagates or creates the ID and puts it in MDC and the response header.
- Health: `/api/health` returns the spec body. Also expose actuator `health`.
- Memory: it must run on Render free (512 MB). Provide a Dockerfile:
  - multi-stage, eclipse-temurin 21;
  - layered jar;
  - non-root user;
  - `JAVA_OPTS` default `-XX:MaxRAMPercentage=70 -XX:+UseSerialGC -Xss512k`;
  - listening on `PORT` env (default 8080) via `server.port=${PORT:8080}`.
- Tests: JUnit 5 covering:
  - pricing: promotion selection, best promo, minCases;
  - credit approval rule;
  - insufficient stock gives 409;
  - unknown SKU gives 422;
  - idempotency;
  - security: 401 without a token, 403 when a REP calls approve or the dashboard;
  - one `@SpringBootTest` end-to-end flow: demo-login, then quote, then order, then approve.
  Run `./mvnw -q verify` and make sure everything passes.
- README.md in `core-api/` with run commands, env vars, endpoint list, and a short "Java 21 features used" section.

Finally:
1. Run the app with `./mvnw spring-boot:run` (demo profile) in the background.
2. Curl these endpoints and capture the output: health, demo-login, outlets, products, quote, order, dashboard (as MANAGER), ai-summary in mock mode.
3. Build the Docker image (`docker build -t orderpilot-core-api .`), run it, and curl `/api/health`.
4. Stop everything you started.

Report back:
- the final endpoint list;
- any contract deviations;
- test results;
- the exact env vars;
- image size and the observed memory use of the container (`docker stats --no-stream`);
- anything left unfinished.
Do not create git repos, commit, push or deploy anything.
```
