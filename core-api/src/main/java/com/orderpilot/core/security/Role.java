package com.orderpilot.core.security;

import java.util.Locale;
import java.util.Optional;
import java.util.stream.Stream;

public enum Role {
    REP, MANAGER;

    public String authority() {
        return "ROLE_" + name();
    }

    /**
     * Maps a token role to an app role. Accepts the bare value ({@code MANAGER}) and namespaced Entra app-role values
     * such as {@code OrderPilot.Manager}.
     */
    public static Optional<Role> fromClaim(String value) {
        var normalised = value.strip().toUpperCase(Locale.ROOT);
        return Stream.of(values())
                .filter(role -> normalised.equals(role.name()) || normalised.endsWith("." + role.name()))
                .findFirst();
    }
}
