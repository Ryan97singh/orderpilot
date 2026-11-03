package com.orderpilot.core.api.dto;

import com.orderpilot.core.service.LineItem;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record OrderLineRequest(
        @NotBlank @Size(max = 40) String sku,
        @NotNull @Min(1) @Max(10_000) Integer qtyCases) {

    public LineItem toLineItem() {
        return new LineItem(sku, qtyCases);
    }
}
