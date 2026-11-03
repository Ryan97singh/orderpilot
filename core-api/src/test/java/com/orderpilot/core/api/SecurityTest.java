package com.orderpilot.core.api;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;

class SecurityTest extends ApiTestSupport {

    @Autowired
    JwtEncoder encoder;

    @Test
    void healthAndDocsArePublic() throws Exception {
        mvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$.service").value("core-api"))
                .andExpect(jsonPath("$.version").isNotEmpty());
        mvc.perform(get("/actuator/health")).andExpect(status().isOk());
        mvc.perform(get("/v3/api-docs")).andExpect(status().isOk());
    }

    @Test
    void requestWithoutTokenIs401ProblemWithBearerChallenge() throws Exception {
        mvc.perform(get("/api/outlets").header("X-Request-Id", "test-req-1"))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string(HttpHeaders.WWW_AUTHENTICATE, containsString("Bearer")))
                .andExpect(header().string("X-Request-Id", "test-req-1"))
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.requestId").value("test-req-1"));
    }

    @Test
    void tamperedOrExpiredTokensAre401() throws Exception {
        var token = login("REP");
        mvc.perform(get("/api/me").header(HttpHeaders.AUTHORIZATION, bearer(token + "x")))
                .andExpect(status().isUnauthorized());

        var expired = JwtClaimsSet.builder().issuer("orderpilot-demo").subject("rep-001")
                .issuedAt(Instant.now().minusSeconds(7200)).expiresAt(Instant.now().minusSeconds(3600))
                .claim("roles", List.of("REP")).build();
        var expiredToken = encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), expired))
                .getTokenValue();
        mvc.perform(get("/api/me").header(HttpHeaders.AUTHORIZATION, bearer(expiredToken)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void tokenFromAnotherIssuerIsRejected() throws Exception {
        var claims = JwtClaimsSet.builder().issuer("someone-else").subject("x")
                .expiresAt(Instant.now().plusSeconds(600)).claim("roles", List.of("MANAGER")).build();
        var token = encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims))
                .getTokenValue();

        mvc.perform(get("/api/me").header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void meReturnsTheUserFromTheToken() throws Exception {
        mvc.perform(get("/api/me").header(HttpHeaders.AUTHORIZATION, bearer(login("MANAGER"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("mgr-001"))
                .andExpect(jsonPath("$.roles[0]").value("MANAGER"));
    }

    @Test
    void repCannotApproveOrders() throws Exception {
        mvc.perform(post("/api/orders/1/approve").header(HttpHeaders.AUTHORIZATION, bearer(login("REP"))))
                .andExpect(status().isForbidden())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.code").value("forbidden"));
    }

    @Test
    void repCannotSeeTheDashboardButManagerCan() throws Exception {
        mvc.perform(get("/api/dashboard/summary").header(HttpHeaders.AUTHORIZATION, bearer(login("REP"))))
                .andExpect(status().isForbidden());

        mvc.perform(get("/api/dashboard/summary").header(HttpHeaders.AUTHORIZATION, bearer(login("MANAGER"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ordersBySource.UI").isNumber())
                .andExpect(jsonPath("$.ordersBySource.AI_AGENT").isNumber())
                .andExpect(jsonPath("$.revenueByDay.length()").value(14))
                .andExpect(jsonPath("$.lowStock[0].availableCases").isNumber())
                .andExpect(jsonPath("$.topProducts[0].revenue").isNumber());
    }

    @Test
    void demoLoginRejectsUnknownRoles() throws Exception {
        mvc.perform(post("/api/auth/demo-login").contentType(MediaType.APPLICATION_JSON).content("{\"role\":\"ADMIN\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
    }

    @Test
    void corsPreflightAllowsTheConfiguredOrigin() throws Exception {
        mvc.perform(options("/api/orders")
                        .header(HttpHeaders.ORIGIN, "http://localhost:3000")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS,
                                "Authorization, Content-Type, X-Request-Id, Idempotency-Key"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "http://localhost:3000"))
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_HEADERS, containsString("Idempotency-Key")))
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_HEADERS, containsString("X-Request-Id")));
    }

    @Test
    void corsExposesTheRequestIdHeader() throws Exception {
        mvc.perform(get("/api/health").header(HttpHeaders.ORIGIN, "http://localhost:3000"))
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_EXPOSE_HEADERS, containsString("X-Request-Id")));
    }
}
