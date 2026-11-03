package com.orderpilot.core.service;

import com.orderpilot.core.domain.OrderSource;
import com.orderpilot.core.domain.Warehouse;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

public record DashboardSummary(
        LocalDate asOf,
        String currency,
        long ordersToday,
        BigDecimal revenueMtd,
        long pendingApprovals,
        List<LowStockItem> lowStock,
        List<TopProduct> topProducts,
        Map<OrderSource, Long> ordersBySource,
        List<DailyRevenue> revenueByDay) {

    public record LowStockItem(String sku, String productName, Warehouse warehouse, int availableCases,
                               int onHandCases, int reservedCases) {
    }

    public record TopProduct(String sku, String productName, long qtyCases, BigDecimal revenue) {
    }

    public record DailyRevenue(LocalDate date, BigDecimal total) {
    }
}
