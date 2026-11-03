# Credit Policy

Gulf Beverage Distribution LLC (fictional) sells to trade outlets on credit. This policy explains
how credit limits work, what happens when an order goes over the limit, and who can approve it.
All amounts are in AED.

## Credit limits by channel

Every outlet has a credit limit set by credit control when the account is opened.
Typical starting limits:

| Channel | Typical starting limit | Payment terms |
|---|---|---|
| GROCERY | AED 15,000 – 40,000 | 30 days from invoice |
| HORECA | AED 25,000 – 80,000 | 45 days from invoice |
| MODERN_TRADE | AED 100,000 – 500,000 | 60 days from invoice |

Limits are reviewed every six months, or earlier on request from the area sales manager.

## Available credit

Available credit = credit limit − outstanding balance. The outstanding balance includes all
unpaid invoices and all confirmed orders that have not been invoiced yet. Reps can see an
outlet's available credit in the outlet profile and on every quote.

## Orders that exceed the credit limit

If the outstanding balance plus the new order total is above the credit limit, the order is
**not rejected**. It is created with status **PENDING_APPROVAL** and appears in the manager's
approval queue. Stock is **not reserved** until a manager approves it.

- The rep should tell the outlet that delivery depends on approval.
- A manager approves (status becomes CONFIRMED and stock is reserved) or cancels the order.
- Approvals are normally handled the same working day if submitted before 2:00 PM.

The OrderPilot quote shows `creditStatus: NEEDS_APPROVAL` when this will happen, so the rep knows
before confirming.

## Who can approve

Only users with the **MANAGER** role can approve orders in PENDING_APPROVAL. Area sales managers
may approve up to AED 25,000 above the limit. Anything larger goes to the head of credit control
by email with the order number.

## Overdue accounts

If any invoice is more than 30 days past its due date, credit control may put the outlet on
**credit hold**. While on hold, new orders still go to PENDING_APPROVAL regardless of amount.
Collecting a cheque or bank transfer receipt during the visit is the fastest way to release a hold.

## Cash orders

Outlets on credit hold can still buy for cash on delivery (COD). Mention "COD" in the order notes;
the driver collects payment and the order is not counted against the credit limit.
