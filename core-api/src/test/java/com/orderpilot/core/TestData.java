package com.orderpilot.core;

import com.orderpilot.core.domain.Category;
import com.orderpilot.core.domain.Channel;
import com.orderpilot.core.domain.Inventory;
import com.orderpilot.core.domain.Outlet;
import com.orderpilot.core.domain.Product;
import com.orderpilot.core.domain.Promotion;
import com.orderpilot.core.domain.Warehouse;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

/** Small fixtures for unit tests; "today" is 2026-11-03 in Dubai. */
public final class TestData {

    public static final Clock CLOCK = Clock.fixed(Instant.parse("2026-11-03T08:00:00Z"), ZoneId.of("Asia/Dubai"));
    public static final LocalDate TODAY = LocalDate.of(2026, 11, 3);

    public static final Product COLA = product("FZ-COLA-330-24", "FizzUp Cola 330ml Can", "38.00", true);
    public static final Product WATER = product("PP-STIL-500-24", "Pure Peak Still Water 500ml", "18.00", true);
    public static final Product LEMON = product("FZ-LEMN-330-24", "FizzUp Lemon-Lime 330ml Can", "36.00", false);

    private TestData() {
    }

    public static Product product(String sku, String name, String price, boolean active) {
        return new Product(sku, name, "FizzUp", Category.CARBONATED, "24 x 330ml can", new BigDecimal(price), active);
    }

    public static Outlet groceryInDubai(String creditLimit, String outstanding) {
        return new Outlet("OUT-T1", "Test Grocery", Channel.GROCERY, "Dubai", new BigDecimal(creditLimit),
                new BigDecimal(outstanding), "rep-001");
    }

    public static Outlet horecaInDubai() {
        return new Outlet("OUT-T2", "Test Cafe", Channel.HORECA, "Dubai", new BigDecimal("100000"),
                BigDecimal.ZERO, "rep-001");
    }

    public static Promotion promotion(long id, String sku, Channel channel, String pct, int minCases) {
        return new Promotion(id, sku, channel, new BigDecimal(pct), minCases, TODAY.minusDays(10), TODAY.plusDays(10),
                "promo " + id);
    }

    public static Inventory stock(Product product, int onHand, int reserved) {
        return new Inventory(product, Warehouse.DXB, onHand, reserved);
    }
}
