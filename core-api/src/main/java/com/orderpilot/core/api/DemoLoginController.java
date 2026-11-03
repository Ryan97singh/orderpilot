package com.orderpilot.core.api;

import com.orderpilot.core.api.dto.DemoLoginRequest;
import com.orderpilot.core.api.dto.DemoLoginResponse;
import com.orderpilot.core.api.dto.UserDto;
import com.orderpilot.core.security.DemoTokenService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/** Only registered when AUTH_MODE=demo; with Entra ID the endpoint does not exist (404). */
@RestController
@Tag(name = "Auth")
@ConditionalOnProperty(name = "app.auth.mode", havingValue = "demo", matchIfMissing = true)
class DemoLoginController {

    private final DemoTokenService tokens;

    DemoLoginController(DemoTokenService tokens) {
        this.tokens = tokens;
    }

    @PostMapping("/api/auth/demo-login")
    @SecurityRequirements
    @Operation(summary = "Issue an 8h HS256 demo token for a fictional REP or MANAGER")
    DemoLoginResponse demoLogin(@Valid @RequestBody DemoLoginRequest request) {
        var issued = tokens.issue(request.role());
        return new DemoLoginResponse(issued.token(), "Bearer", issued.expiresAt(), UserDto.from(issued.user()));
    }
}
