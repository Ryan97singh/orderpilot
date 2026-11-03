package com.orderpilot.core.service;

import static java.util.stream.Collectors.groupingBy;
import static java.util.stream.Collectors.reducing;

import com.orderpilot.core.config.AppProperties;
import com.orderpilot.core.domain.OrderSource;
import com.orderpilot.core.domain.OrderStatus;
import com.orderpilot.core.repository.InventoryRepository;
import com.orderpilot.core.repository.SalesOrderRepository;
import com.orderpilot.core.service.DashboardSummary.DailyRevenue;
import com.orderpilot.core.service.DashboardSummary.LowStockItem;
import com.orderpilot.core.service.DashboardSummary.TopProduct;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Manager KPIs. Revenue counts CONFIRMED and DISPATCHED orders; days are calendar days in the business time zone.
 * Source mix and top products cover the last 30 days, the revenue trend the last 14.
 */
@Service
@Transactional(readOnly = true)
public class DashboardService {

    private static final int TREND_DAYS = 14;
    private static final int WINDOW_DAYS = 30;
    private static final int TOP_N = 5;
    private static final int LOW_STOCK_ROWS = 10;

    private final SalesOrderRepository orders;
    private final InventoryRepository inventory;
    private final AppProperties properties;
    private final Clock clock;

    public DashboardService(SalesOrderRepository orders, InventoryRepository inventory, AppProperties properties,
                            Clock clock) {
        this.orders = orders;
        this.inventory = inventory;
        this.properties = properties;
        this.clock = clock;
    }

    public DashboardSummary summary() {
        var today = LocalDate.now(clock);
        var windowStart = startOf(today.minusDays(WINDOW_DAYS - 1));

        var lowStock = inventory.findLowStock(properties.business().lowStockThreshold(), Limit.of(LOW_STOCK_ROWS))
                .stream()
                .map(i -> new LowStockItem(i.getSku(), i.getProduct().getName(), i.getWarehouse(), i.availableCases(),
                        i.getOnHandCases(), i.getReservedCases()))
                .toList();

        var topProducts = orders.topProducts(OrderStatus.REVENUE, windowStart, Limit.of(TOP_N)).stream()
                .map(p -> new TopProduct(p.sku(), p.productName(), p.qtyCases(), p.revenue()))
                .toList();

        Map<OrderSource, Long> bySource = new EnumMap<>(OrderSource.class);
        Stream.of(OrderSource.values()).forEach(source -> bySource.put(source, 0L));
        orders.countBySource(windowStart).forEach(row -> bySource.put(row.source(), row.orders()));

        return new DashboardSummary(
                today,
                properties.business().currency(),
                orders.countByCreatedAtGreaterThanEqualAndStatusNot(startOf(today), OrderStatus.CANCELLED),
                orders.sumTotal(OrderStatus.REVENUE, startOf(today.withDayOfMonth(1))),
                orders.countByStatus(OrderStatus.PENDING_APPROVAL),
                lowStock,
                topProducts,
                bySource,
                revenueTrend(today));
    }

    private List<DailyRevenue> revenueTrend(LocalDate today) {
        var firstDay = today.minusDays(TREND_DAYS - 1);
        var totalsByDay = orders.amountsSince(OrderStatus.REVENUE, startOf(firstDay)).stream()
                .collect(groupingBy(a -> LocalDate.ofInstant(a.createdAt(), clock.getZone()),
                        reducing(BigDecimal.ZERO, SalesOrderRepository.DatedAmount::total, BigDecimal::add)));
        return firstDay.datesUntil(today.plusDays(1))
                .map(day -> new DailyRevenue(day, totalsByDay.getOrDefault(day, BigDecimal.ZERO)))
                .toList();
    }

    private Instant startOf(LocalDate day) {
        return day.atStartOfDay(clock.getZone()).toInstant();
    }
}
