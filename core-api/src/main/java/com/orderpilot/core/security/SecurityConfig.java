package com.orderpilot.core.security;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import com.orderpilot.core.config.AppProperties;
import java.nio.charset.StandardCharsets;
import java.util.List;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.util.StringUtils;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

/**
 * Stateless JWT resource server. Coarse rules live here (public vs authenticated); role checks are declared on the
 * controllers with {@code @PreAuthorize}. The {@link JwtDecoder} depends on {@code AUTH_MODE}.
 */
@Configuration(proxyBeanMethods = false)
@EnableMethodSecurity
public class SecurityConfig {

    private static final String[] PUBLIC_PATHS = {
            "/api/health", "/api/auth/demo-login",
            "/swagger-ui.html", "/swagger-ui/**", "/v3/api-docs/**",
            "/actuator/health/**", "/error"
    };

    @Bean
    SecurityFilterChain apiSecurity(HttpSecurity http, ProblemSecurityHandlers problemHandlers) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(cors -> { })
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers(PUBLIC_PATHS).permitAll()
                        .anyRequest().authenticated())
                .oauth2ResourceServer(oauth2 -> oauth2
                        .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter()))
                        .authenticationEntryPoint(problemHandlers)
                        .accessDeniedHandler(problemHandlers))
                .exceptionHandling(errors -> errors
                        .authenticationEntryPoint(problemHandlers)
                        .accessDeniedHandler(problemHandlers));
        return http.build();
    }

    @Bean
    JwtAuthenticationConverter jwtAuthenticationConverter() {
        var converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(new RolesClaimConverter());
        return converter;
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource(AppProperties properties) {
        var cors = new CorsConfiguration();
        // Patterns allow entries such as https://*.vercel.app for preview deployments.
        cors.setAllowedOriginPatterns(properties.cors().origins());
        cors.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        cors.setAllowedHeaders(List.of("*"));
        cors.setExposedHeaders(List.of("X-Request-Id", "Location", "Idempotent-Replayed"));
        cors.setMaxAge(3600L);
        var source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", cors);
        return source;
    }

    /** AUTH_MODE=demo: HS256 tokens signed and verified with the shared JWT_SECRET. */
    @Configuration(proxyBeanMethods = false)
    @ConditionalOnProperty(name = "app.auth.mode", havingValue = "demo", matchIfMissing = true)
    static class DemoJwtConfig {

        private static final Logger log = LoggerFactory.getLogger(DemoJwtConfig.class);
        private static final String DEV_SECRET = "orderpilot-dev-secret-change-me-please-32b";

        private final SecretKey key;
        private final String issuer;

        DemoJwtConfig(AppProperties properties) {
            var secret = properties.auth().jwtSecret().getBytes(StandardCharsets.UTF_8);
            if (secret.length < 32) {
                throw new IllegalStateException("JWT_SECRET must be at least 32 bytes for HS256 (got %d)".formatted(secret.length));
            }
            if (DEV_SECRET.equals(properties.auth().jwtSecret())) {
                log.warn("Using the built-in development JWT_SECRET; set JWT_SECRET outside local demos");
            }
            this.key = new SecretKeySpec(secret, "HmacSHA256");
            this.issuer = properties.auth().demoIssuer();
        }

        @Bean
        JwtEncoder jwtEncoder() {
            return new NimbusJwtEncoder(new ImmutableSecret<>(key));
        }

        @Bean
        JwtDecoder jwtDecoder() {
            var decoder = NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();
            decoder.setJwtValidator(JwtValidators.createDefaultWithIssuer(issuer));
            return decoder;
        }
    }

    /**
     * AUTH_MODE=entra: Spring Boot builds the decoder from {@code spring.security.oauth2.resourceserver.jwt.issuer-uri}
     * (derived from ENTRA_TENANT_ID) and validates {@code aud} against {@code ...jwt.audiences} (ENTRA_AUDIENCE).
     * Signing keys are fetched lazily from the tenant's JWKS on the first request.
     */
    @Configuration(proxyBeanMethods = false)
    @ConditionalOnProperty(name = "app.auth.mode", havingValue = "entra")
    static class EntraJwtConfig {

        EntraJwtConfig(AppProperties properties) {
            var entra = properties.auth().entra();
            if (!StringUtils.hasText(entra.tenantId()) || !StringUtils.hasText(entra.audience())) {
                throw new IllegalStateException("AUTH_MODE=entra requires ENTRA_TENANT_ID and ENTRA_AUDIENCE");
            }
        }
    }
}
