package com.orderpilot.core.domain;

import java.util.Map;

public final class NotFoundException extends DomainException {

    private NotFoundException(String resource, Object id) {
        super(resource + "-not-found", "%s %s was not found".formatted(capitalize(resource), id),
                Map.of("resource", resource, "id", String.valueOf(id)));
    }

    public static NotFoundException outlet(long id) {
        return new NotFoundException("outlet", id);
    }

    public static NotFoundException product(String sku) {
        return new NotFoundException("product", sku);
    }

    public static NotFoundException order(long id) {
        return new NotFoundException("order", id);
    }

    private static String capitalize(String s) {
        return Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }
}
