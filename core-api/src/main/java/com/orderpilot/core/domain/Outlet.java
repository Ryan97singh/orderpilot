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

@Entity
@Table(name = "outlet")
public class Outlet {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 20)
    private String code;

    @Column(nullable = false, length = 120)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Channel channel;

    @Column(nullable = false, length = 60)
    private String city;

    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal creditLimit;

    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal outstandingBalance;

    @Column(length = 64)
    private String salesRepId;

    protected Outlet() {
    }

    public Outlet(String code, String name, Channel channel, String city, BigDecimal creditLimit,
                  BigDecimal outstandingBalance, String salesRepId) {
        this.code = code;
        this.name = name;
        this.channel = channel;
        this.city = city;
        this.creditLimit = creditLimit;
        this.outstandingBalance = outstandingBalance;
        this.salesRepId = salesRepId;
    }

    public BigDecimal availableCredit() {
        return creditLimit.subtract(outstandingBalance).max(BigDecimal.ZERO);
    }

    public Warehouse warehouse() {
        return Warehouse.forCity(city);
    }

    public Long getId() {
        return id;
    }

    public String getCode() {
        return code;
    }

    public String getName() {
        return name;
    }

    public Channel getChannel() {
        return channel;
    }

    public String getCity() {
        return city;
    }

    public BigDecimal getCreditLimit() {
        return creditLimit;
    }

    public BigDecimal getOutstandingBalance() {
        return outstandingBalance;
    }

    public String getSalesRepId() {
        return salesRepId;
    }
}
