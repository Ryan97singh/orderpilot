package com.orderpilot.core.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;

/** Snapshot of a priced line; product name and prices are copied so later catalog changes do not rewrite history. */
@Entity
@Table(name = "order_line")
public class OrderLine {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id", nullable = false)
    private SalesOrder order;

    @Column(nullable = false)
    private int lineNo;

    @Column(nullable = false, length = 40)
    private String sku;

    @Column(nullable = false, length = 120)
    private String productName;

    @Column(nullable = false)
    private int qtyCases;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal unitPrice;

    @Column(nullable = false, precision = 5, scale = 2)
    private BigDecimal discountPct;

    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal lineTotal;

    protected OrderLine() {
    }

    OrderLine(SalesOrder order, int lineNo, String sku, String productName, int qtyCases, BigDecimal unitPrice,
              BigDecimal discountPct, BigDecimal lineTotal) {
        this.order = order;
        this.lineNo = lineNo;
        this.sku = sku;
        this.productName = productName;
        this.qtyCases = qtyCases;
        this.unitPrice = unitPrice;
        this.discountPct = discountPct;
        this.lineTotal = lineTotal;
    }

    public int getLineNo() {
        return lineNo;
    }

    public String getSku() {
        return sku;
    }

    public String getProductName() {
        return productName;
    }

    public int getQtyCases() {
        return qtyCases;
    }

    public BigDecimal getUnitPrice() {
        return unitPrice;
    }

    public BigDecimal getDiscountPct() {
        return discountPct;
    }

    public BigDecimal getLineTotal() {
        return lineTotal;
    }
}
