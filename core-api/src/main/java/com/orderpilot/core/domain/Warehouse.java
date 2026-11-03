package com.orderpilot.core.domain;

import java.util.Locale;

public enum Warehouse {
    DXB, AUH, SHJ;

    /** Outlets are served from the warehouse in their city. */
    public static Warehouse forCity(String city) {
        return switch (city.strip().toLowerCase(Locale.ROOT)) {
            case "dubai" -> DXB;
            case "abu dhabi" -> AUH;
            case "sharjah" -> SHJ;
            default -> throw new IllegalArgumentException("No warehouse serves city '%s'".formatted(city));
        };
    }
}
