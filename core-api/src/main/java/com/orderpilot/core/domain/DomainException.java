package com.orderpilot.core.domain;

import java.util.Map;

/**
 * Business failures the API reports as RFC 7807 problems. The hierarchy is sealed so the exception handler can map
 * each kind to an HTTP status with an exhaustive {@code switch}.
 */
public sealed abstract class DomainException extends RuntimeException
        permits NotFoundException, RuleViolationException, ConflictException {

    private final String code;
    private final Map<String, Object> details;

    protected DomainException(String code, String message, Map<String, Object> details) {
        super(message);
        this.code = code;
        this.details = Map.copyOf(details);
    }

    /** Stable, machine-readable problem code, e.g. {@code insufficient-stock}. */
    public String code() {
        return code;
    }

    public Map<String, Object> details() {
        return details;
    }
}
