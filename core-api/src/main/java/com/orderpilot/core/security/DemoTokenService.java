package com.orderpilot.core.security;

import com.orderpilot.core.config.AppProperties;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;

/** Issues HS256 demo tokens for fictional users; only active when {@code AUTH_MODE=demo}. */
@Service
@ConditionalOnProperty(name = "app.auth.mode", havingValue = "demo", matchIfMissing = true)
public class DemoTokenService {

    public record IssuedToken(String token, Instant expiresAt, CurrentUser user) {
    }

    private static final Map<Role, CurrentUser> DEMO_USERS = Map.of(
            Role.REP, new CurrentUser("rep-001", "Aisha Rahman", "aisha.rahman@orderpilot.example", List.of(Role.REP)),
            Role.MANAGER, new CurrentUser("mgr-001", "Omar Haddad", "omar.haddad@orderpilot.example", List.of(Role.MANAGER)));

    private final JwtEncoder encoder;
    private final AppProperties.Auth auth;
    private final Clock clock;

    public DemoTokenService(JwtEncoder encoder, AppProperties properties, Clock clock) {
        this.encoder = encoder;
        this.auth = properties.auth();
        this.clock = clock;
    }

    public IssuedToken issue(Role role) {
        var user = DEMO_USERS.get(role);
        var now = Instant.now(clock);
        var expiresAt = now.plus(auth.tokenTtl());
        var claims = JwtClaimsSet.builder()
                .issuer(auth.demoIssuer())
                .subject(user.id())
                .issuedAt(now)
                .expiresAt(expiresAt)
                .claim("name", user.name())
                .claim("email", user.email())
                .claim(RolesClaimConverter.ROLES_CLAIM, user.roles().stream().map(Role::name).toList())
                .build();
        var header = JwsHeader.with(MacAlgorithm.HS256).type("JWT").build();
        var token = encoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
        return new IssuedToken(token, expiresAt, user);
    }
}
