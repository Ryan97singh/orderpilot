package com.orderpilot.core.api.dto;

import com.orderpilot.core.service.LineItem;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.util.List;

public record QuoteRequest(
        @NotNull @Positive Long outletId,
        @NotEmpty @Size(max = 50) List<@NotNull @Valid OrderLineRequest> lines) {

    public List<LineItem> lineItems() {
        return lines.stream().map(OrderLineRequest::toLineItem).toList();
    }
}
