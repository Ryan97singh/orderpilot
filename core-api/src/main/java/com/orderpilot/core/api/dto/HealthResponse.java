package com.orderpilot.core.api.dto;

public record HealthResponse(String status, String service, String version, String authMode, String llmProvider) {
}
