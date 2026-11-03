package com.orderpilot.core.domain;

import java.util.EnumSet;
import java.util.Set;

public enum OrderStatus {
    PENDING_APPROVAL, CONFIRMED, DISPATCHED, CANCELLED;

    /** Statuses that count as booked revenue on the dashboard. */
    public static final Set<OrderStatus> REVENUE = EnumSet.of(CONFIRMED, DISPATCHED);
}
