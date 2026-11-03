package com.orderpilot.core.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "promotion")
public class Promotion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 40)
    private String sku;

    /** {@code null} means the promotion applies to every channel. */
    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private Channel channel;

    @Column(nullable = false, precision = 5, scale = 2)
    private BigDecimal discountPct;

    @Column(nullable = false)
    private int minCases;

    @Column(nullable = false)
    private LocalDate validFrom;

    @Column(nullable = false)
    private LocalDate validTo;

    @Column(nullable = false, length = 200)
    private String description;

    protected Promotion() {
    }

    public Promotion(Long id, String sku, Channel channel, BigDecimal discountPct, int minCases, LocalDate validFrom,
                     LocalDate validTo, String description) {
        this.id = id;
        this.sku = sku;
        this.channel = channel;
        this.discountPct = discountPct;
        this.minCases = minCases;
        this.validFrom = validFrom;
        this.validTo = validTo;
        this.description = description;
    }

    /** Business rule 2: channel matches (or is open), quantity reaches the threshold, and the day is in range. */
    public boolean appliesTo(Channel outletChannel, int qtyCases, LocalDate day) {
        return (channel == null || channel == outletChannel)
                && qtyCases >= minCases
                && !day.isBefore(validFrom)
                && !day.isAfter(validTo);
    }

    public Long getId() {
        return id;
    }

    public String getSku() {
        return sku;
    }

    public Channel getChannel() {
        return channel;
    }

    public BigDecimal getDiscountPct() {
        return discountPct;
    }

    public int getMinCases() {
        return minCases;
    }

    public LocalDate getValidFrom() {
        return validFrom;
    }

    public LocalDate getValidTo() {
        return validTo;
    }

    public String getDescription() {
        return description;
    }
}
