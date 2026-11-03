# How OrderPilot was built with Claude

OrderPilot was built with Claude as the primary development tool. This folder holds the actual prompts,
in the order they were used. The workflow:

1. **Requirement → analysis.** A business requirement (here: "sales reps should be able to place orders by
   chatting from their phone, with credit and stock checks") is broken into actors, entities, business rules
   and open questions. See `00-requirement-analysis.md`.
2. **Analysis → shared contract.** One spec that every layer codes against: domain model, business rules,
   endpoint table with request/response shapes, auth model, error format, provider switches.
   See `../docs/SPEC.md`. This is the single most important prompt artefact: it lets the backend, AI service
   and frontend be generated in parallel without drifting apart.
3. **Contract → one build prompt per layer.** Each prompt states the goal, points to the contract, fixes the
   stack and versions, lists non-negotiable rules (security, human-in-the-loop, no secrets, memory limits),
   says what "done" means (tests that must pass, commands to run, what to report back), and what NOT to touch.
   See `01-core-api-java.md`, `02-ai-service-python.md`, `03-web-nextjs-pwa.md`.
4. **Review and iterate.** Generated code is read, run, tested, and corrected with short follow-up prompts
   (`04-review-and-fix.md`). Nothing is accepted without a passing test or a manual check in the browser.
5. **Runtime prompts.** The prompts the *application* sends to the model at runtime (intent classification,
   order extraction with a JSON schema, grounded answers with citations, Prompt Studio) live in
   `../ai-service/app/agent/prompts.py`.

## Prompt-writing rules used throughout

- Give Claude the **why** (who uses it, what a good result looks like), not just the what.
- Point to **one source of truth** (the spec) instead of repeating requirements in each prompt.
- Fix **versions and stack** explicitly (Java 21, Spring Boot 3.x, Next.js App Router, Python 3.12).
- State **hard rules** as rules: "the agent never places an order without user confirmation".
- Define **done**: which tests, which commands, which manual checks, what to report.
- Define **boundaries**: which folders to touch, and "do not deploy, commit or use real keys".
- Ask for **deviations to be written down** rather than silently changing the contract.
