package com.orderpilot.core.api;

import com.orderpilot.core.api.dto.UserDto;
import com.orderpilot.core.security.CurrentUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Tag(name = "Auth")
class MeController {

    @GetMapping("/api/me")
    @Operation(summary = "The caller, as read from the bearer token")
    UserDto me(@AuthenticationPrincipal Jwt jwt) {
        return UserDto.from(CurrentUser.from(jwt));
    }
}
