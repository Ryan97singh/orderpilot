package com.orderpilot.core.domain;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/** The request conflicts with the current state of stock or of the order (HTTP 409). */
public final class ConflictException extends DomainException {

    public record Shortfall(String sku, Warehouse warehouse, int requested, int available) {
    }

    private ConflictException(String code, String message, Map<String, Object> details) {
        super(code, message, details);
    }

    /** Business rule 3: orders that cannot be fulfilled from the outlet's warehouse are rejected. */
    public static ConflictException insufficientStock(List<Shortfall> shortfalls) {
        var summary = shortfalls.stream()
                .map(s -> "%s (requested %d, available %d in %s)".formatted(s.sku(), s.requested(), s.available(), s.warehouse()))
                .collect(Collectors.joining("; "));
        return new ConflictException("insufficient-stock", "Insufficient stock: " + summary,
                Map.of("shortfalls", List.copyOf(shortfalls)));
    }

    public static ConflictException invalidTransition(String orderNo, OrderStatus current, String action) {
        return new ConflictException("invalid-order-state",
                "Cannot %s order %s because it is %s".formatted(action, orderNo, current),
                Map.of("orderNo", orderNo, "status", current.name()));
    }

    public static ConflictException concurrentUpdate() {
        return new ConflictException("concurrent-update",
                "The order or stock was changed by another request; please retry", Map.of());
    }
}
