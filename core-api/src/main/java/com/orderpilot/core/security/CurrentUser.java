package com.orderpilot.core.security;

import java.util.List;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.util.StringUtils;

/** The caller, read from a validated access token. */
public record CurrentUser(String id, String name, String email, List<Role> roles) {

    public static CurrentUser from(Jwt jwt) {
        // Entra: "oid" is the stable user id; demo tokens only carry "sub".
        var id = firstNonBlank(jwt.getClaimAsString("oid"), jwt.getSubject());
        var email = firstNonBlank(jwt.getClaimAsString("email"), jwt.getClaimAsString("preferred_username"));
        var name = firstNonBlank(jwt.getClaimAsString("name"), email, id);
        return new CurrentUser(id, name, email, RolesClaimConverter.rolesOf(jwt));
    }

    private static String firstNonBlank(String... values) {
        for (var value : values) {
            if (StringUtils.hasText(value)) {
                return value;
            }
        }
        return null;
    }
}
