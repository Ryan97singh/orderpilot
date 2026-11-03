package com.orderpilot.core.domain;

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
import jakarta.persistence.Table;
import jakarta.persistence.Version;

/** Stock of one SKU in one warehouse. Optimistic locking prevents two orders from reserving the same cases. */
@Entity
@Table(name = "inventory")
public class Inventory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "sku", nullable = false)
    private Product product;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 3)
    private Warehouse warehouse;

    @Column(nullable = false)
    private int onHandCases;

    @Column(nullable = false)
    private int reservedCases;

    @Version
    private long version;

    protected Inventory() {
    }

    public Inventory(Product product, Warehouse warehouse, int onHandCases, int reservedCases) {
        this.product = product;
        this.warehouse = warehouse;
        this.onHandCases = onHandCases;
        this.reservedCases = reservedCases;
    }

    public int availableCases() {
        return onHandCases - reservedCases;
    }

    public void reserve(int cases) {
        if (cases <= 0 || cases > availableCases()) {
            throw new IllegalStateException("Cannot reserve %d cases of %s in %s (available %d)"
                    .formatted(cases, product.getSku(), warehouse, availableCases()));
        }
        reservedCases += cases;
    }

    public void release(int cases) {
        reservedCases = Math.max(0, reservedCases - cases);
    }

    public String getSku() {
        return product.getSku();
    }

    public Product getProduct() {
        return product;
    }

    public Warehouse getWarehouse() {
        return warehouse;
    }

    public int getOnHandCases() {
        return onHandCases;
    }

    public int getReservedCases() {
        return reservedCases;
    }
}
