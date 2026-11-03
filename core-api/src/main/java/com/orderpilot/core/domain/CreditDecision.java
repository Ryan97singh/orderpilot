package com.orderpilot.core.domain;

import java.math.BigDecimal;

/**
 * Business rule 4: an order whose total would take the outlet over its credit limit needs manager approval.
 * Modelled as a sealed type so every caller handles both outcomes exhaustively.
 */
public sealed interface CreditDecision {

    record WithinLimit(BigDecimal creditRemainingAfterOrder) implements CreditDecision {
    }

    record ExceedsLimit(BigDecimal amountOverLimit) implements CreditDecision {
    }

    static CreditDecision evaluate(Outlet outlet, BigDecimal orderTotal) {
        var exposure = outlet.getOutstandingBalance().add(orderTotal);
        return exposure.compareTo(outlet.getCreditLimit()) > 0
                ? new ExceedsLimit(exposure.subtract(outlet.getCreditLimit()))
                : new WithinLimit(outlet.getCreditLimit().subtract(exposure));
    }

    default OrderStatus initialOrderStatus() {
        return switch (this) {
            case WithinLimit ignored -> OrderStatus.CONFIRMED;
            case ExceedsLimit ignored -> OrderStatus.PENDING_APPROVAL;
        };
    }

    /** The {@code creditStatus} value of a quote: {@code OK} or {@code NEEDS_APPROVAL}. */
    default String status() {
        return switch (this) {
            case WithinLimit ignored -> "OK";
            case ExceedsLimit ignored -> "NEEDS_APPROVAL";
        };
    }
}
