package com.orderpilot.core.api;

import com.orderpilot.core.ai.OrderSummaryService;
import com.orderpilot.core.api.dto.HealthResponse;
import com.orderpilot.core.config.AppProperties;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.Locale;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.info.BuildProperties;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Tag(name = "Health")
@SecurityRequirements
class HealthController {

    private final HealthResponse health;

    HealthController(ObjectProvider<BuildProperties> build, AppProperties properties, OrderSummaryService ai) {
        var version = build.getIfAvailable() instanceof BuildProperties b ? b.getVersion() : "dev";
        this.health = new HealthResponse("UP", "core-api", version,
                properties.auth().mode().name().toLowerCase(Locale.ROOT), ai.provider());
    }

    @GetMapping("/api/health")
    HealthResponse health() {
        return health;
    }
}
