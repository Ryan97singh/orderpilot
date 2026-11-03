package com.orderpilot.core.api.dto;

import java.time.Instant;

public record DemoLoginResponse(String token, String tokenType, Instant expiresAt, UserDto user) {
}
