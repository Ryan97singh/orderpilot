package com.orderpilot.core.api.dto;

import com.orderpilot.core.domain.OrderSource;
import com.orderpilot.core.service.LineItem;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.util.List;

/** Same body as a quote, plus optional {@code notes} and {@code source} (defaults to {@code UI}). */
public record PlaceOrderRequest(
        @NotNull @Positive Long outletId,
        @NotEmpty @Size(max = 50) List<@NotNull @Valid OrderLineRequest> lines,
        @Size(max = 500) String notes,
        OrderSource source) {

    public List<LineItem> lineItems() {
        return lines.stream().map(OrderLineRequest::toLineItem).toList();
    }
}
