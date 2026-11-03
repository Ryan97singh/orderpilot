package com.orderpilot.core.service;

import static java.util.stream.Collectors.toMap;

import com.orderpilot.core.domain.ConflictException;
import com.orderpilot.core.domain.ConflictException.Shortfall;
import com.orderpilot.core.domain.Inventory;
import com.orderpilot.core.domain.NotFoundException;
import com.orderpilot.core.domain.OrderLine;
import com.orderpilot.core.domain.OrderStatus;
import com.orderpilot.core.domain.Outlet;
import com.orderpilot.core.domain.SalesOrder;
import com.orderpilot.core.domain.Warehouse;
import com.orderpilot.core.repository.InventoryRepository;
import com.orderpilot.core.repository.OrderNumberGenerator;
import com.orderpilot.core.repository.OutletRepository;
import com.orderpilot.core.repository.SalesOrderRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class OrderService {

    private static final Logger log = LoggerFactory.getLogger(OrderService.class);

    private final OutletRepository outlets;
    private final SalesOrderRepository orders;
    private final InventoryRepository inventory;
    private final PricingService pricing;
    private final OrderNumberGenerator orderNumbers;
    private final TransactionTemplate transaction;
    private final Clock clock;

    public OrderService(OutletRepository outlets, SalesOrderRepository orders, InventoryRepository inventory,
                        PricingService pricing, OrderNumberGenerator orderNumbers, TransactionTemplate transaction,
                        Clock clock) {
        this.outlets = outlets;
        this.orders = orders;
        this.inventory = inventory;
        this.pricing = pricing;
        this.orderNumbers = orderNumbers;
        this.transaction = transaction;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public Quote quote(long outletId, List<LineItem> lines) {
        return pricing.quote(requireOutlet(outletId), lines);
    }

    /**
     * Business rule 5: a repeated Idempotency-Key returns the original order. The lookup-then-insert race between two
     * concurrent requests with the same key is closed by the unique index: the loser re-reads the winner's order.
     */
    public OrderPlacement place(PlaceOrderCommand command) {
        var key = command.idempotencyKey();
        if (key != null) {
            var existing = orders.findByIdempotencyKey(key);
            if (existing.isPresent()) {
                return new OrderPlacement(existing.get(), true);
            }
        }
        try {
            return new OrderPlacement(transaction.execute(status -> create(command)), false);
        } catch (DataIntegrityViolationException e) {
            if (key == null) {
                throw e;
            }
            return orders.findByIdempotencyKey(key)
                    .map(order -> new OrderPlacement(order, true))
                    .orElseThrow(() -> e);
        }
    }

    @Transactional
    public SalesOrder approve(long orderId) {
        var order = requireOrder(orderId);
        order.approve();
        reserveStock(order);
        log.atInfo().addKeyValue("orderNo", order.getOrderNo()).log("Order {} approved", order.getOrderNo());
        return order;
    }

    @Transactional
    public SalesOrder cancel(long orderId) {
        var order = requireOrder(orderId);
        if (order.cancel() == OrderStatus.CONFIRMED) {
            releaseStock(order);
        }
        log.atInfo().addKeyValue("orderNo", order.getOrderNo()).log("Order {} cancelled", order.getOrderNo());
        return order;
    }

    @Transactional(readOnly = true)
    public SalesOrder get(long orderId) {
        return requireOrder(orderId);
    }

    @Transactional(readOnly = true)
    public Page<SalesOrder> search(Long outletId, OrderStatus status, Pageable pageable) {
        Specification<SalesOrder> spec = (root, query, cb) -> cb.conjunction();
        if (outletId != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("outlet").get("id"), outletId));
        }
        if (status != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("status"), status));
        }
        return orders.findAll(spec, pageable);
    }

    @Transactional
    public SalesOrder attachAiSummary(long orderId, String summary) {
        var order = requireOrder(orderId);
        order.attachAiSummary(summary);
        return order;
    }

    private SalesOrder create(PlaceOrderCommand command) {
        var outlet = requireOutlet(command.outletId());
        var quote = pricing.quote(outlet, command.lines());
        if (!quote.fulfillable()) {
            throw ConflictException.insufficientStock(quote.shortfalls());
        }

        var now = Instant.now(clock);
        var order = new SalesOrder(
                orderNumbers.next(LocalDate.ofInstant(now, clock.getZone()).getYear()),
                outlet,
                quote.credit().initialOrderStatus(),
                command.source(),
                command.createdBy(),
                now,
                command.notes(),
                command.idempotencyKey());
        for (var line : quote.lines()) {
            order.addLine(line.product().getSku(), line.product().getName(), line.qtyCases(), line.unitPrice(),
                    line.discountPct(), line.discountAmount(), line.lineTotal());
        }
        if (order.getStatus() == OrderStatus.CONFIRMED) {
            reserveStock(order);
        }
        var saved = orders.saveAndFlush(order);
        log.atInfo()
                .addKeyValue("orderNo", saved.getOrderNo())
                .addKeyValue("status", saved.getStatus())
                .addKeyValue("source", saved.getSource())
                .addKeyValue("total", saved.getTotal())
                .log("Order {} placed as {}", saved.getOrderNo(), saved.getStatus());
        return saved;
    }

    /** Business rule 4: confirmed orders hold stock in the outlet's warehouse. */
    private void reserveStock(SalesOrder order) {
        var warehouse = order.getOutlet().warehouse();
        var stock = stockFor(order, warehouse);
        var shortfalls = order.getLines().stream()
                .filter(line -> availableOf(stock.get(line.getSku())) < line.getQtyCases())
                .map(line -> new Shortfall(line.getSku(), warehouse, line.getQtyCases(), availableOf(stock.get(line.getSku()))))
                .toList();
        if (!shortfalls.isEmpty()) {
            throw ConflictException.insufficientStock(shortfalls);
        }
        order.getLines().forEach(line -> stock.get(line.getSku()).reserve(line.getQtyCases()));
    }

    private void releaseStock(SalesOrder order) {
        var stock = stockFor(order, order.getOutlet().warehouse());
        order.getLines().forEach(line -> {
            var item = stock.get(line.getSku());
            if (item != null) {
                item.release(line.getQtyCases());
            }
        });
    }

    private Map<String, Inventory> stockFor(SalesOrder order, Warehouse warehouse) {
        var skus = order.getLines().stream().map(OrderLine::getSku).distinct().toList();
        return inventory.findBySkusInWarehouse(skus, warehouse).stream()
                .collect(toMap(Inventory::getSku, Function.identity()));
    }

    private static int availableOf(Inventory item) {
        return item == null ? 0 : item.availableCases();
    }

    private Outlet requireOutlet(long outletId) {
        return outlets.findById(outletId).orElseThrow(() -> NotFoundException.outlet(outletId));
    }

    private SalesOrder requireOrder(long orderId) {
        return orders.findWithLinesById(orderId).orElseThrow(() -> NotFoundException.order(orderId));
    }
}
