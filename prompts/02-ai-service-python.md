# 02 — AI service (Python FastAPI / LangGraph) build prompt

Sent to Claude together with `docs/SPEC.md`. The three layer prompts ran in parallel against the same contract.

```text
Build the `ai-service` of a demo app called OrderPilot, in `/Users/ryan/Downloads/Adlertech_AI_App_Developer/orderpilot/ai-service/`. Read the full contract first: `/Users/ryan/Downloads/Adlertech_AI_App_Developer/orderpilot/docs/SPEC.md`. Implement the ai-service parts exactly: endpoints, the LangGraph agent, providers, auth and the knowledge base. Two other agents are building `core-api/` (Java Spring Boot, port 8080) and `web/` (Next.js) at the same time against this contract. Don't touch their folders or SPEC.md. Write any deviation in `ai-service/README.md` under "Contract notes".

Context: this is an interview demo for an "AI Application Developer" role. It must show:
- Python + FastAPI as an AI microservice next to a Java backend;
- LangGraph agent workflows with tool calling against the Java API;
- Claude (Anthropic SDK) with Azure OpenAI as a switchable provider;
- Azure AI Search for retrieval, with a local fallback;
- human-in-the-loop confirmation before any write action.
Interviewers will read the code, so make it clean, typed (pydantic v2, type hints), small modules and sparse comments. Suggested structure:
- `app/main.py`
- `app/api/` (routes)
- `app/agent/` (graph, nodes, state, prompts)
- `app/llm/` (base protocol, claude, azure_openai, mock, budget)
- `app/search/` (base, azure_ai_search, local_bm25)
- `app/clients/core_api.py` (httpx async client that forwards the user's bearer token and `X-Request-Id`)
- `app/security.py` (JWT validation: HS256 with `JWT_SECRET` in demo mode; Entra ID JWKS validation in entra mode via PyJWT `PyJWKClient`)
- `app/config.py` (pydantic-settings)
- `knowledge/*.md`

Details:
- Python 3.12-compatible code. The local machine has python3 3.14; create a venv with whatever python is available. If a dependency won't install on 3.14, try `uv` (`pip install uv` then `uv venv -p 3.12`), or pin versions that have wheels. Keep dependencies lean, because the service will also be deployed as a Vercel Python function (250 MB limit): fastapi, uvicorn, pydantic-settings, httpx, pyjwt[crypto], anthropic, openai, langgraph (langchain-core comes with it; avoid the full langchain package), rank-bm25, azure-search-documents. No torch, no sentence-transformers.
- Agent: use LangGraph `StateGraph` with the nodes in the spec and conditional edges.
  - Use the LLM for intent classification and structured order extraction (JSON output validated by pydantic), with the mock provider doing regex/keyword extraction so everything works offline and in tests.
  - Entity resolution calls core-api `GET /api/outlets?q=` and `/api/products?q=`. Handle ambiguity by asking a clarifying question instead of guessing; include candidates in the reply.
  - The quote comes from `POST /api/orders/quote`.
  - The agent NEVER calls `POST /api/orders`; only `/ai/chat/confirm` does, with an `Idempotency-Key`.
  - Session state: in-memory dict keyed by `session_id` (note in the README that production would use Redis/Cosmos). Keep last N messages.
  - Every node appends a step to `steps` for the UI trace.
- Prompts: put system prompts in `app/agent/prompts.py` as clear, structured prompts (role, rules, output schema, examples). The interviewer cares a lot about prompt engineering quality.
- Prompt Studio endpoint: an LLM turns a business requirement into analysis + a structured Claude build prompt + acceptance criteria. The mock returns a sensible template-based result using the requirement text.
- LLM budget: `LLM_DAILY_BUDGET_USD` (default 1). Estimate cost from token usage, and fall back to mock when exceeded.
- Claude: default model `claude-sonnet-5-5` via env `CLAUDE_MODEL`, official `anthropic` SDK, with sensible `max_tokens`. Never crash on provider errors: fall back to mock and note it in `steps`.
- Knowledge base: write 6 realistic markdown docs for the fictional distributor (Gulf/UAE, AED): credit policy, promotion rules, returns & damages policy, product guide (the brands FizzUp, Oasis Juice, Pure Peak Water, VoltX Energy), delivery schedule & cut-off times, new-outlet onboarding. Keep them consistent with the core-api rules in the spec: credit approval when the limit is exceeded, promo minCases, and the city-to-warehouse mapping. Local BM25 search chunks them by heading.
- CORS from env `CORS_ORIGINS`, `X-Request-Id` middleware, JSON logging, and `/ai/health`.
- Vercel deployment:
  - add `api/index.py` (or whatever Vercel's current FastAPI support needs: an ASGI `app` exposed at the expected entrypoint);
  - add `vercel.json` routing everything to the app;
  - add `requirements.txt`;
  - make sure no import-time network calls happen.
- Docker: also provide a `Dockerfile` (python:3.12-slim, non-root, uvicorn on `$PORT`, default 8000) for Azure Container Apps / docker-compose.
- Tests: pytest + respx to mock core-api, run with `LLM_PROVIDER=mock`. Cover:
  - the order flow end to end (chat returns a quote and a pending_action, confirm places the order with an Idempotency-Key);
  - an ambiguous outlet leads to a clarifying question;
  - the knowledge question returns citations;
  - prompt studio;
  - auth: 401 without a token, 200 with a valid demo HS256 token;
  - the budget fallback.
  Make all tests pass.
- README.md: run commands, env vars, a graph diagram (mermaid), and the provider/fallback design.

Finally:
1. Run the service locally with uvicorn and curl `/ai/health`, `/ai/knowledge/search` and `/ai/prompt-studio`. For `/ai/chat`, use a demo JWT you mint yourself with the default dev secret. Core-api may not be running; if not, demonstrate chat with a small local stub or just rely on the tests.
2. Build the Docker image and curl health.
3. Stop everything you started.

Report back:
- the endpoint list and the response shapes;
- test results;
- env vars;
- dependency install size (`du -sh` of site-packages);
- any contract deviations.
Do not create git repos, commit, push or deploy. If you have an ANTHROPIC_API_KEY in the environment, do NOT use it; keep all runs on mock.
```
