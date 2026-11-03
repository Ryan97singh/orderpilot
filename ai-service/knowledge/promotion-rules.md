# Promotion Rules

Trade promotions are price discounts on specific products, set by trade marketing. OrderPilot
applies them automatically on every quote and order. Reps cannot type discounts manually.

## How a promotion is defined

Each promotion has:

- **SKU**: the single product it applies to.
- **Channel**: GROCERY, HORECA or MODERN_TRADE, or blank for all channels.
- **Discount %**: applied to the case price of that line.
- **Minimum cases (minCases)**: the line quantity needed to qualify.
- **Valid from / valid to**: the dates the promotion runs, inclusive.

## When a promotion applies

A promotion applies to an order line only when **all** of these are true:

1. The outlet's channel matches the promotion channel, or the promotion is for all channels.
2. The quantity on that line is **at least minCases**. Quantities are not combined across
   different SKUs or across separate orders.
3. Today's date is within the validity window.

## Best promotion wins, no stacking

If several promotions qualify for the same line, only the one with the **highest discount** is
applied. Promotions never stack, and a discount applies to one line only.

Example: FizzUp Cola 330ml has an all-channel 5% promotion from 10 cases and a HORECA 8%
promotion from 20 cases. A hotel ordering 25 cases gets 8%. A grocery ordering 25 cases gets 5%.
A hotel ordering 12 cases gets 5%.

## Upselling to the threshold

If an outlet is just below minCases, reps are encouraged to suggest topping up to the threshold,
as long as the outlet has storage and the product will sell within its shelf life.
Do not push quantities that would cause expiry returns (see the returns policy).

## Promotions and credit approval

Discounts reduce the order total before the credit check. An order that is just above the credit
limit may fall under it once a promotion is applied.

## Requests for special pricing

Special prices outside active promotions (for example, for a hotel opening event) must be requested
from the area sales manager at least 5 working days before the order. They are created as a
promotion for that outlet's channel and applied automatically like any other.
