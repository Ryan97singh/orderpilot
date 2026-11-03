package com.orderpilot.core.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;

@Entity
@Table(name = "product")
public class Product {

    @Id
    @Column(length = 40)
    private String sku;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(nullable = false, length = 60)
    private String brand;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Category category;

    @Column(nullable = false, length = 40)
    private String packSize;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal casePrice;

    @Column(nullable = false)
    private boolean active;

    protected Product() {
    }

    public Product(String sku, String name, String brand, Category category, String packSize, BigDecimal casePrice,
                   boolean active) {
        this.sku = sku;
        this.name = name;
        this.brand = brand;
        this.category = category;
        this.packSize = packSize;
        this.casePrice = casePrice;
        this.active = active;
    }

    public String getSku() {
        return sku;
    }

    public String getName() {
        return name;
    }

    public String getBrand() {
        return brand;
    }

    public Category getCategory() {
        return category;
    }

    public String getPackSize() {
        return packSize;
    }

    public BigDecimal getCasePrice() {
        return casePrice;
    }

    public boolean isActive() {
        return active;
    }
}
