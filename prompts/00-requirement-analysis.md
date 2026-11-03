# 00 — Requirement analysis prompt

**Input requirement (from the business):**

> Our field sales reps visit 30–40 outlets a day. Today they write orders on paper or WhatsApp them to the
> office, and the office keys them in. We often promise stock we don't have, and some outlets go over their
> credit limit. We want reps to place orders from their phone by just typing or saying what the outlet wants.
> Managers need to see what's coming in and approve risky orders. It must work with our Microsoft login and
> run on Azure.

**Prompt:**

```
You are a senior business analyst and solution architect for an FMCG beverage distributor in the UAE.

Analyse the requirement below and produce, in markdown:
1. Actors and their goals.
2. Core entities with key fields (only what the requirement needs).
3. Business rules, each written as a testable statement (Given/When/Then is fine).
4. The main user flows, step by step, including the unhappy paths (unknown product, out of stock,
   over credit limit, ambiguous outlet name).
5. Where AI adds value and where it must NOT act on its own (human-in-the-loop points).
6. Non-functional requirements: security (Microsoft Entra ID), auditability, mobile/offline use, cost.
7. Open questions for the business, ranked by how much they change the design.

Rules:
- Do not invent integrations the requirement does not mention; list them as open questions instead.
- Prefer simple, verifiable rules over clever ones.
- Keep it under two pages.

Requirement:
<requirement text above>
```

**What came out of it (summarised):** actors Sales Rep / Sales Manager; entities Outlet, Product, Inventory,
Promotion, SalesOrder, OrderLine; rules for promotions (min cases, channel, validity), stock by city
warehouse, credit approval, idempotent order creation; the AI may *propose* an order but only the rep
confirms it; managers approve over-limit orders. This became `docs/SPEC.md`.
