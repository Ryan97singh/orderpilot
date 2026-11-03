package com.orderpilot.core.service;

import com.orderpilot.core.domain.Product;
import com.orderpilot.core.domain.Promotion;
import com.orderpilot.core.domain.Warehouse;
import java.math.BigDecimal;
import java.util.Optional;

public record PricedLine(
        Product product,
        int qtyCases,
        BigDecimal unitPrice,
        Optional<Promotion> promotion,
        BigDecimal discountPct,
        BigDecimal discountAmount,
        BigDecimal lineTotal,
        Warehouse warehouse,
        int availableCases) {

    public boolean fulfillable() {
        return availableCases >= qtyCases;
    }
}
