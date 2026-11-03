package com.orderpilot.core.api.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.orderpilot.core.domain.OrderLine;
import com.orderpilot.core.domain.OrderSource;
import com.orderpilot.core.domain.OrderStatus;
import com.orderpilot.core.domain.SalesOrder;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record OrderDto(
        long id,
        String orderNo,
        long outletId,
        String outletCode,
        String outletName,
        OrderStatus status,
        BigDecimal subtotal,
        BigDecimal discount,
        BigDecimal total,
        OrderSource source,
        String createdBy,
        Instant createdAt,
        String notes,
        String aiSummary,
        @JsonInclude(JsonInclude.Include.NON_NULL) List<OrderLineDto> lines) {

    public record OrderLineDto(String sku, String productName, int qtyCases, BigDecimal unitPrice,
                               BigDecimal discountPct, BigDecimal lineTotal) {

        static OrderLineDto from(OrderLine line) {
            return new OrderLineDto(line.getSku(), line.getProductName(), line.getQtyCases(), line.getUnitPrice(),
                    line.getDiscountPct(), line.getLineTotal());
        }
    }

    /** Order with its lines (detail views, create, approve, cancel, ai-summary). */
    public static OrderDto detail(SalesOrder order) {
        return of(order, order.getLines().stream().map(OrderLineDto::from).toList());
    }

    /** Order without lines (list views). */
    public static OrderDto summary(SalesOrder order) {
        return of(order, null);
    }

    private static OrderDto of(SalesOrder order, List<OrderLineDto> lines) {
        var outlet = order.getOutlet();
        return new OrderDto(order.getId(), order.getOrderNo(), outlet.getId(), outlet.getCode(), outlet.getName(),
                order.getStatus(), order.getSubtotal(), order.getDiscount(), order.getTotal(), order.getSource(),
                order.getCreatedBy(), order.getCreatedAt(), order.getNotes(), order.getAiSummary(), lines);
    }
}
