package com.orderpilot.core.service;

import com.orderpilot.core.domain.OrderSource;
import java.util.List;

public record PlaceOrderCommand(
        long outletId,
        List<LineItem> lines,
        String notes,
        OrderSource source,
        String createdBy,
        String idempotencyKey) {

    public PlaceOrderCommand {
        lines = List.copyOf(lines);
        source = source == null ? OrderSource.UI : source;
    }
}
