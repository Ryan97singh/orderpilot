# 04 — Review and fix prompts

Short follow-up prompts used after each layer was generated. They are deliberately specific: they name
the file, the observed behaviour, the expected behaviour, and how to prove the fix.

```
Integration check: start core-api (demo profile) and ai-service together, mint a REP token with
POST /api/auth/demo-login, then send "Order 20 cases of FizzUp Cola 330ml for Al Noor Grocery" to /ai/chat.
Expected: a quote with a pending_action and no order created yet. Then call /ai/chat/confirm twice with
the same payload. Expected: exactly one order (idempotency). Fix whichever side breaks the contract in
docs/SPEC.md, add a test that reproduces it, and report the diff.
```

```
Security review of core-api: list every endpoint with the role that can call it, confirm with tests that a
REP gets 403 on /orders/{id}/approve and /dashboard/summary, and that no endpoint other than health,
demo-login and docs is reachable without a token. Do not weaken any rule to make a test pass.
```

```
The Render free instance has 512 MB. Measure the core-api container with docker stats after a few requests.
If it is above 400 MB, tune JAVA_OPTS (heap percentage, serial GC, thread stack) and re-measure. Report
before/after numbers.
```

```
Review the web app on a 390px-wide screen: every page must be usable with one thumb, nothing may scroll
horizontally, and the quote card must be readable without zooming. Fix layout issues and show
screenshots before and after.
```
