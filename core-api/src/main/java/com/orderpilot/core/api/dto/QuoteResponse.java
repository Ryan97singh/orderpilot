package com.orderpilot.core.api.dto;

import com.orderpilot.core.domain.Warehouse;
import com.orderpilot.core.service.PricedLine;
import com.orderpilot.core.service.Quote;
import java.math.BigDecimal;
import java.util.List;

public record QuoteResponse(
        OutletDto outlet,
        List<QuoteLineDto> lines,
        BigDecimal subtotal,
        BigDecimal discount,
        BigDecimal total,
        String creditStatus,
        boolean fulfillable,
        List<String> warnings) {

    public record QuoteLineDto(
            String sku,
            String productName,
            int qtyCases,
            BigDecimal unitPrice,
            BigDecimal discountPct,
            PromotionDto promotion,
            BigDecimal lineTotal,
            Warehouse warehouse,
            int available,
            boolean fulfillable) {

        static QuoteLineDto from(PricedLine line) {
            return new QuoteLineDto(line.product().getSku(), line.product().getName(), line.qtyCases(),
                    line.unitPrice(), line.discountPct(), line.promotion().map(PromotionDto::from).orElse(null),
                    line.lineTotal(), line.warehouse(), line.availableCases(), line.fulfillable());
        }
    }

    public static QuoteResponse from(Quote quote) {
        return new QuoteResponse(OutletDto.from(quote.outlet()),
                quote.lines().stream().map(QuoteLineDto::from).toList(),
                quote.subtotal(), quote.discount(), quote.total(), quote.credit().status(), quote.fulfillable(),
                quote.warnings());
    }
}
