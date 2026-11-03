package com.orderpilot.core.api.dto;

import com.orderpilot.core.security.Role;
import jakarta.validation.constraints.NotNull;

public record DemoLoginRequest(@NotNull Role role) {
}
