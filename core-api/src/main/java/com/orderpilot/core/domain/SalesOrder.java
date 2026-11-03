package com.orderpilot.core.domain;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@Entity
@Table(name = "sales_order")
public class SalesOrder {

    private static final int AI_SUMMARY_MAX = 4000;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 20)
    private String orderNo;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "outlet_id", nullable = false)
    private Outlet outlet;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private OrderStatus status;

    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal subtotal;

    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal discount;

    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal total;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private OrderSource source;

    @Column(nullable = false, length = 64)
    private String createdBy;

    @Column(nullable = false)
    private Instant createdAt;

    @Column(length = 500)
    private String notes;

    @Column(length = AI_SUMMARY_MAX)
    private String aiSummary;

    @Column(length = 100)
    private String idempotencyKey;

    @Version
    private long version;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("lineNo")
    private List<OrderLine> lines = new ArrayList<>();

    protected SalesOrder() {
    }

    public SalesOrder(String orderNo, Outlet outlet, OrderStatus initialStatus, OrderSource source, String createdBy,
                      Instant createdAt, String notes, String idempotencyKey) {
        this.orderNo = orderNo;
        this.outlet = outlet;
        this.status = initialStatus;
        this.source = source;
        this.createdBy = createdBy;
        this.createdAt = createdAt;
        this.notes = notes;
        this.idempotencyKey = idempotencyKey;
        this.subtotal = BigDecimal.ZERO;
        this.discount = BigDecimal.ZERO;
        this.total = BigDecimal.ZERO;
    }

    public void addLine(String sku, String productName, int qtyCases, BigDecimal unitPrice, BigDecimal discountPct,
                        BigDecimal discountAmount, BigDecimal lineTotal) {
        lines.add(new OrderLine(this, lines.size() + 1, sku, productName, qtyCases, unitPrice, discountPct, lineTotal));
        subtotal = subtotal.add(unitPrice.multiply(BigDecimal.valueOf(qtyCases)));
        discount = discount.add(discountAmount);
        total = total.add(lineTotal);
    }

    /** PENDING_APPROVAL -> CONFIRMED. Stock is reserved by the caller in the same transaction. */
    public void approve() {
        if (status != OrderStatus.PENDING_APPROVAL) {
            throw ConflictException.invalidTransition(orderNo, status, "approve");
        }
        status = OrderStatus.CONFIRMED;
    }

    /** Cancels the order and returns the previous status so the caller knows whether stock must be released. */
    public OrderStatus cancel() {
        return switch (status) {
            case PENDING_APPROVAL, CONFIRMED -> {
                var previous = status;
                status = OrderStatus.CANCELLED;
                yield previous;
            }
            case DISPATCHED, CANCELLED -> throw ConflictException.invalidTransition(orderNo, status, "cancel");
        };
    }

    public void attachAiSummary(String summary) {
        this.aiSummary = summary.length() > AI_SUMMARY_MAX ? summary.substring(0, AI_SUMMARY_MAX) : summary;
    }

    public Long getId() {
        return id;
    }

    public String getOrderNo() {
        return orderNo;
    }

    public Outlet getOutlet() {
        return outlet;
    }

    public OrderStatus getStatus() {
        return status;
    }

    public BigDecimal getSubtotal() {
        return subtotal;
    }

    public BigDecimal getDiscount() {
        return discount;
    }

    public BigDecimal getTotal() {
        return total;
    }

    public OrderSource getSource() {
        return source;
    }

    public String getCreatedBy() {
        return createdBy;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public String getNotes() {
        return notes;
    }

    public String getAiSummary() {
        return aiSummary;
    }

    public String getIdempotencyKey() {
        return idempotencyKey;
    }

    public List<OrderLine> getLines() {
        return Collections.unmodifiableList(lines);
    }
}
