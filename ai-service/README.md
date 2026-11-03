# OrderPilot ai-service

Python AI microservice running beside the Java `core-api`. It hosts:

- a **LangGraph agent** that turns a sales rep's chat message into a priced order proposal by
  calling core-api tools on behalf of the user, and **never places an order without the rep's confirmation**;
- **retrieval-augmented answers** over the company knowledge base (Azure AI Search, local BM25 fallback);
- **Prompt Studio**, which turns a business requirement into a structured Claude build prompt.

Stack: Python 3.12, FastAPI, LangGraph, pydantic v2, Anthropic SDK (Claude), Azure OpenAI (switchable),
Azure AI Search SDK, httpx, PyJWT.

## Run locally

```bash
python3.12 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
cp .env.example .env                       # defaults: mock LLM, local search, demo auth
.venv/bin/uvicorn app.main:app --reload --port 8000
```

- Docs: <http://localhost:8000/ai/docs>
- Tests: `LLM_PROVIDER=mock .venv/bin/pytest` (tests force mock anyway)
- Lint and types: `.venv/bin/ruff check app tests && .venv/bin/mypy app`

To call an authenticated endpoint without core-api, mint a demo token with the shared secret:

```bash
TOKEN=$(.venv/bin/python -c "import jwt,time;print(jwt.encode({'sub':'rep-1','name':'Rep','roles':['REP'],\
'iss':'orderpilot-demo','exp':int(time.time())+3600},'orderpilot-dev-secret-change-me-please-32b',algorithm='HS256'))")
curl -s localhost:8000/ai/knowledge/search -H "Authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -d '{"query":"cut-off time Abu Dhabi"}'
```

Normally the token comes from core-api: `POST /api/auth/demo-login {"role":"REP"}`.

## Endpoints

All endpoints except `/ai/health` need `Authorization: Bearer <token>`. Every response carries `X-Request-Id`.

| Method | Path | Response |
|---|---|---|
| GET | `/ai/health` | `{"status":"ok","service","version","llm_provider","search_provider","auth_mode"}` |
| POST | `/ai/chat` | `{"reply","intent","quote","pending_action","order","citations":[{doc,title,snippet}],"steps":[{node,detail}]}` |
| POST | `/ai/chat/confirm` | `{"reply","order"}`; places the order through core-api with an `Idempotency-Key` |
| POST | `/ai/knowledge/search` | `{"query","provider","hits":[{doc,title,snippet,score}]}` |
| POST | `/ai/prompt-studio` | `{"analysis":{actors,entities,rules,open_questions},"prompt","acceptance_criteria"}`; header `X-LLM-Provider` |

`pending_action`:

```json
{
  "type": "PLACE_ORDER",
  "payload": {"outletId": 3, "lines": [{"sku": "FZ-COLA-330-24", "qtyCases": 10}], "notes": null, "source": "AI_AGENT"},
  "expires_at": 1793688000,
  "signature": "9f1c…"
}
```

## Agent graph

```mermaid
flowchart TD
    START([start]) --> classify_intent
    classify_intent -- ORDER --> extract_order
    classify_intent -- KNOWLEDGE --> retrieve
    classify_intent -- GENERAL --> general_answer
    extract_order -- details missing --> ask_user
    extract_order --> resolve_entities
    resolve_entities -- ambiguous / not found --> ask_user
    resolve_entities --> quote
    quote -- core-api error --> ask_user
    quote --> propose
    retrieve --> answer_with_citations
    propose --> END([end])
    ask_user --> END
    answer_with_citations --> END
    general_answer --> END

    subgraph core-api tools, called with the user's token
      T1[GET /api/outlets?q=]
      T2[GET /api/products?q=]
      T3[POST /api/orders/quote]
    end
    resolve_entities -.-> T1 & T2
    quote -.-> T3
    propose -. "pending_action (signed)" .-> UI[[Rep taps Confirm]]
    UI -.-> C["/ai/chat/confirm -> POST /api/orders + Idempotency-Key"]
```

| Node | What it does | LLM |
|---|---|---|
| `classify_intent` | Routes to ORDER / KNOWLEDGE / GENERAL. | structured `IntentResult` |
| `extract_order` | Outlet reference, lines (product reference + cases), notes, missing info. Merges a follow-up into the draft waiting for clarification. | structured `OrderExtraction` |
| `resolve_entities` | Searches core-api outlets and products. It auto-picks only when the reference matches exactly one candidate on every word; otherwise it asks, listing up to 5 numbered candidates. | none (deterministic) |
| `quote` | `POST /api/orders/quote` (promotions, stock and credit are priced in core-api). | none |
| `propose` | Renders the quote and returns a signed `pending_action`. Stock shortfalls get no confirmation card. | none |
| `ask_user` | Returns the clarifying question. | none |
| `retrieve` / `answer_with_citations` | Search, then a grounded answer that cites `[n]`; citations keep only the sources actually cited. | text |
| `general_answer` | Short help and capabilities. | text |

Every node appends to `steps`, including any provider fallback, so the UI can show a trace.

### Human in the loop

The graph has no node that writes. Only `/ai/chat/confirm` calls `POST /api/orders`, and it:

1. verifies the `pending_action` HMAC signature (bound to user `sub`, `session_id`, payload and expiry).
   A client cannot change quantities between the quote and the confirmation, and confirm stays stateless
   across serverless instances;
2. derives `Idempotency-Key = {session_id}-{sha256(payload, expires_at)[:24]}`, so a double tap returns
   the same order while a new proposal creates a new order;
3. forwards the user's bearer token and `X-Request-Id`, so core-api enforces roles, credit and stock again.

## Providers and fallback

```
LLM_PROVIDER=claude|azure_openai|mock          SEARCH_PROVIDER=azure_ai_search|local
            │                                             │
      LLMService ── budget exceeded? ──► mock       SearchService ── error? ──► local BM25
            │       provider error?   ──► mock
            │       invalid JSON?     ──► mock
            ▼
  ClaudeProvider / AzureOpenAIProvider / MockProvider  (one protocol: generate(task, system, messages, schema))
```

- **Claude** (`app/llm/claude.py`): official `anthropic` SDK, model `CLAUDE_MODEL` (default
  `claude-sonnet-5-5`), structured outputs through `output_config.format` (JSON schema generated from the
  pydantic model, then validated again with pydantic), `effort` per task (`low` for routing/extraction,
  `medium` for answers), `max_tokens` per task (1k to 8k). Server-side refusal fallback is enabled
  (`fallbacks="default"`), and SDK errors are mapped to `LLMProviderError` through a typed exception chain.
- **Azure OpenAI** (`app/llm/azure_openai.py`): `AsyncAzureOpenAI` with strict `json_schema` response format.
- **Mock** (`app/llm/mock.py`): deterministic, reads the same prompts as the real models (regex/keyword
  extraction, template answers, template Prompt Studio). The demo and the tests run with no key.
- **Budget** (`app/llm/budget.py`): estimated cost per call from token usage × price per MTok
  (Sonnet 5.5: $2 in / $10 out). When `LLM_DAILY_BUDGET_USD` is spent, calls go to mock until UTC midnight.
  The counter is per process; production would keep it in Redis.
- A missing key or bad configuration does not crash startup: the service reports the configured provider
  and every call falls back to mock, with the reason in `steps` (or the `X-LLM-Fallback` header).
- System prompts live in `app/agent/prompts.py`: role, domain context, rules, output schema and
  examples. They are static (cache-friendly); request data is wrapped in XML tags and treated as data.

## Knowledge base

Six markdown policies for the fictional distributor in `knowledge/`: credit, promotions, returns and
damages, product guide, delivery schedule and cut-offs, new-outlet onboarding. They match the
core-api rules: over-limit orders go to `PENDING_APPROVAL`, promotions apply at `minCases` and the best
one wins, and the city decides the warehouse (DXB/AUH/SHJ). Chunks are split by `##` heading
(`app/search/chunking.py`). The same chunks feed local BM25 and the Azure index:

```bash
AZURE_SEARCH_ENDPOINT=... AZURE_SEARCH_KEY=<admin key> .venv/bin/python -m scripts.index_knowledge
```

## Environment variables

| Variable | Default | Notes |
|---|---|---|
| `AUTH_MODE` | `demo` | `demo` = HS256 with `JWT_SECRET`; `entra` = Entra ID JWKS (RS256) |
| `JWT_SECRET` | `orderpilot-dev-secret-change-me-please-32b` | Must equal core-api's. Also signs pending actions, so set it in `entra` mode too |
| `ENTRA_TENANT_ID`, `ENTRA_AUDIENCE` | empty | Issuer `https://login.microsoftonline.com/<tenant>/v2.0` |
| `CORE_API_URL` | `http://localhost:8080` | |
| `CORS_ORIGINS` | `http://localhost:3000` | comma-separated |
| `LLM_PROVIDER` | `mock` | `claude`, `azure_openai`, `mock` |
| `LLM_DAILY_BUDGET_USD` | `1` | |
| `ANTHROPIC_API_KEY`, `CLAUDE_MODEL` | empty, `claude-sonnet-5-5` | |
| `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_DEPLOYMENT`, `AZURE_OPENAI_API_VERSION` | empty, empty, `gpt-4o-mini`, `2024-10-21` | |
| `SEARCH_PROVIDER` | `local` | `azure_ai_search`, `local` |
| `AZURE_SEARCH_ENDPOINT`, `AZURE_SEARCH_KEY`, `AZURE_SEARCH_INDEX` | empty, empty, `orderpilot-knowledge` | query key at runtime; admin key for the indexing script |
| `LOG_LEVEL` | `INFO` | JSON logs with `request_id` |
| `SESSION_MAX_MESSAGES`, `PENDING_ACTION_TTL_S` | `20`, `900` | |
| `PORT` | `8000` | Docker only |

## Session state

Conversations are kept in an in-memory dict keyed by `user sub + session_id` (the last N messages, the
order draft and any open clarification). This is enough for one container. **Production would use Redis
or Azure Cosmos DB with a TTL**, so state survives restarts and is shared across replicas and serverless
instances. Clients that send the full history (the web app does) still give the LLM full context, and
confirmations are stateless thanks to the signed `pending_action`.

## Deploy

**Vercel (demo):** `api/index.py` exposes the ASGI `app`; `vercel.json` rewrites every path to it and
bundles `app/` and `knowledge/`. Python 3.12 is pinned with `.python-version`. Dependencies are about
180 MB installed (about 110 MB without bytecode), under the 250 MB function limit. Nothing makes a network
call at import time: SDK clients, the JWKS client and the BM25 index are created lazily.

**Docker / Azure Container Apps:**

```bash
docker build -t orderpilot-ai-service .
docker run -p 8000:8000 -e CORE_API_URL=http://core-api:8080 orderpilot-ai-service
```

`python:3.12-slim`, non-root user, `uvicorn` on `$PORT` (default 8000), healthcheck on `/ai/health`.

## Layout

```
app/
  main.py            app factory, CORS, request-id middleware, error handler
  config.py          pydantic-settings
  security.py        HS256 demo / Entra JWKS validation -> User
  observability.py   JSON logging, X-Request-Id contextvar
  schemas.py         API + LLM structured-output models
  api/               health, chat (+confirm), knowledge, prompt_studio
  agent/             graph, state, nodes/, prompts, resolution, pending (HMAC), session, replies
  llm/               base protocol, claude, azure_openai, mock, budget, service (routing + fallback)
  search/            base (service + fallback), azure_ai_search, local_bm25, chunking
  clients/core_api.py  httpx client forwarding bearer token + X-Request-Id
knowledge/*.md       policy documents
scripts/index_knowledge.py   push chunks to Azure AI Search
tests/               pytest + respx (mocked core-api), mock LLM
```

## Contract notes

Deviations from and additions to `docs/SPEC.md`:

1. **`pending_action` has two extra fields**, `expires_at` (unix seconds) and `signature` (HMAC). The
   client must send the object back unchanged to `/ai/chat/confirm`. A modified, expired or foreign
   action is rejected with **400**. The web app already echoes the object it received.
2. **Idempotency-Key format**: `{session_id}-{24 hex chars}` (spec: "session_id + hash").
3. **`/ai/knowledge/search` returns `{"query","provider","hits":[...]}`**, a wrapper object rather than a
   bare array. Each hit has exactly `doc, title, snippet, score`.
4. **`/ai/health` has extra fields**: `service`, `version`, `auth_mode`.
5. **`/ai/chat/confirm` errors**: core-api 4xx statuses are passed through (for example 409 for
   insufficient stock, 422 for an unknown SKU); 5xx or unreachable becomes **502**. The body is FastAPI's
   `{"detail": "..."}`, not RFC 7807.
6. **`/ai/chat` `order` is always `null`**. Orders are only created by `/ai/chat/confirm`.
7. **Ambiguity candidates** are listed in the markdown `reply` (numbered); there is no separate
   candidates field. The rep can answer with the number, the code/SKU, or distinguishing words.
8. **Auth on every `/ai/*` route except `/ai/health`**, including knowledge search and Prompt Studio.
9. **Default `JWT_SECRET`** is `orderpilot-dev-secret-change-me-please-32b` (42 bytes, long enough for
   HS256 in jjwt). core-api's default must match, or set the same `JWT_SECRET` in both services.
10. **Response headers** `X-LLM-Provider` / `X-LLM-Fallback` on `/ai/prompt-studio` (exposed through CORS).
11. **core-api list endpoints** may return a bare array or a page (`content` / `items`); both are accepted.
    Outlet objects need `id, code, name, city`; product objects need `sku, name` (plus `brand`, `packSize`
    for better matching).
