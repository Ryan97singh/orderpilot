package com.orderpilot.core.service;

import com.orderpilot.core.domain.ConflictException.Shortfall;
import com.orderpilot.core.domain.CreditDecision;
import com.orderpilot.core.domain.Outlet;
import java.math.BigDecimal;
import java.util.List;

public record Quote(
        Outlet outlet,
        List<PricedLine> lines,
        BigDecimal subtotal,
        BigDecimal discount,
        BigDecimal total,
        CreditDecision credit,
        List<String> warnings) {

    public Quote {
        lines = List.copyOf(lines);
        warnings = List.copyOf(warnings);
    }

    public boolean fulfillable() {
        return lines.stream().allMatch(PricedLine::fulfillable);
    }

    public List<Shortfall> shortfalls() {
        return lines.stream()
                .filter(line -> !line.fulfillable())
                .map(line -> new Shortfall(line.product().getSku(), line.warehouse(), line.qtyCases(), line.availableCases()))
                .toList();
    }
}
