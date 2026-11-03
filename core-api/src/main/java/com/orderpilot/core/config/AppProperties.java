package com.orderpilot.core.config;

import com.orderpilot.core.ai.LlmProvider;
import com.orderpilot.core.security.AuthMode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Duration;
import java.time.ZoneId;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Typed view of the {@code app.*} settings in application.yml (env-var driven). */
@Validated
@ConfigurationProperties(prefix = "app")
public record AppProperties(
        @Valid @NotNull Auth auth,
        @Valid @NotNull Cors cors,
        @Valid @NotNull Ai ai,
        @Valid @NotNull Business business) {

    public record Auth(
            @NotNull AuthMode mode,
            @NotBlank String jwtSecret,
            @NotBlank String demoIssuer,
            @NotNull Duration tokenTtl,
            @Valid @NotNull Entra entra) {
    }

    public record Entra(String tenantId, String audience) {
    }

    public record Cors(List<String> origins) {

        public Cors {
            origins = origins == null ? List.of() : List.copyOf(origins);
        }
    }

    public record Ai(@NotNull LlmProvider provider) {
    }

    public record Business(
            @NotNull ZoneId timezone,
            @Min(1) int lowStockThreshold,
            @NotBlank String currency) {
    }
}
