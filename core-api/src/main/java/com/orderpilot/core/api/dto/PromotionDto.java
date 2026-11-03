package com.orderpilot.core.api.dto;

import com.orderpilot.core.domain.Channel;
import com.orderpilot.core.domain.Promotion;
import java.math.BigDecimal;
import java.time.LocalDate;

public record PromotionDto(
        long id,
        String sku,
        Channel channel,
        BigDecimal discountPct,
        int minCases,
        LocalDate validFrom,
        LocalDate validTo,
        String description) {

    public static PromotionDto from(Promotion promotion) {
        return new PromotionDto(promotion.getId(), promotion.getSku(), promotion.getChannel(),
                promotion.getDiscountPct(), promotion.getMinCases(), promotion.getValidFrom(), promotion.getValidTo(),
                promotion.getDescription());
    }
}
