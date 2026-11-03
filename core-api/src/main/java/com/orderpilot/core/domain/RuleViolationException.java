package com.orderpilot.core.domain;

import java.util.List;
import java.util.Map;

/** The request is well-formed but breaks a business rule (HTTP 422). */
public final class RuleViolationException extends DomainException {

    private RuleViolationException(String code, String message, Map<String, Object> details) {
        super(code, message, details);
    }

    /** Business rule 1: every SKU must exist and be active. */
    public static RuleViolationException unknownOrInactiveSkus(List<String> unknown, List<String> inactive) {
        var parts = new StringBuilder();
        if (!unknown.isEmpty()) {
            parts.append("Unknown SKU(s): ").append(String.join(", ", unknown));
        }
        if (!inactive.isEmpty()) {
            if (!parts.isEmpty()) {
                parts.append("; ");
            }
            parts.append("Inactive SKU(s) that can no longer be ordered: ").append(String.join(", ", inactive));
        }
        return new RuleViolationException("invalid-sku", parts.toString(),
                Map.of("unknownSkus", List.copyOf(unknown), "inactiveSkus", List.copyOf(inactive)));
    }
}
