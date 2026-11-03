package com.orderpilot.core.service;

import com.orderpilot.core.domain.SalesOrder;

/** Result of placing an order; {@code replayed} is true when an Idempotency-Key matched an earlier order. */
public record OrderPlacement(SalesOrder order, boolean replayed) {
}
