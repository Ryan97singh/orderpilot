package com.orderpilot.core.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;

/**
 * Runs against the seeded demo data. Tests share one database, so each uses its own outlet:
 * OUT-1005 Karama Corner (Dubai, 39,200 of 40,000 credit used), OUT-1006 Corniche Mini Mart (Abu Dhabi),
 * OUT-1010 Al Majaz (Sharjah).
 */
class OrderApiTest extends ApiTestSupport {

    private static final long KARAMA = 5;
    private static final long CORNICHE = 6;
    private static final long AL_MAJAZ = 10;

    @Test
    void endToEnd_demoLogin_quote_order_approve_summary() throws Exception {
        var rep = login("REP");
        var body = """
                {"outletId": %d, "lines": [{"sku": "FZ-COLA-330-24", "qtyCases": 30}], "source": "AI_AGENT",
                 "notes": "Deliver before 10am"}""".formatted(KARAMA);
        int reservedBefore = reservedInDubai(rep, "FZ-COLA-330-24");

        // Quote: 8% grocery promotion from 25 cases; total pushes Karama over its credit limit.
        mvc.perform(post("/api/orders/quote").header(HttpHeaders.AUTHORIZATION, bearer(rep))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.outlet.code").value("OUT-1005"))
                .andExpect(jsonPath("$.lines[0].discountPct").value(8.00))
                .andExpect(jsonPath("$.lines[0].promotion.minCases").value(25))
                .andExpect(jsonPath("$.lines[0].lineTotal").value(1048.80))
                .andExpect(jsonPath("$.lines[0].fulfillable").value(true))
                .andExpect(jsonPath("$.total").value(1048.80))
                .andExpect(jsonPath("$.creditStatus").value("NEEDS_APPROVAL"))
                .andExpect(jsonPath("$.warnings[0]", containsString("manager approval")));

        // Order: created as PENDING_APPROVAL, nothing reserved yet.
        var created = read(mvc.perform(post("/api/orders").header(HttpHeaders.AUTHORIZATION, bearer(rep))
                        .header("Idempotency-Key", "e2e-flow-1")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated())
                .andExpect(header().string(HttpHeaders.LOCATION, startsWith("/api/orders/")))
                .andExpect(jsonPath("$.orderNo", startsWith("SO-2026-")))
                .andExpect(jsonPath("$.status").value("PENDING_APPROVAL"))
                .andExpect(jsonPath("$.source").value("AI_AGENT"))
                .andExpect(jsonPath("$.createdBy").value("rep-001"))
                .andExpect(jsonPath("$.lines.length()").value(1))
                .andReturn());
        long orderId = created.get("id").asLong();
        assertThat(reservedInDubai(rep, "FZ-COLA-330-24")).isEqualTo(reservedBefore);

        // Approve as manager: CONFIRMED and stock reserved.
        var manager = login("MANAGER");
        mvc.perform(post("/api/orders/{id}/approve", orderId).header(HttpHeaders.AUTHORIZATION, bearer(manager)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CONFIRMED"));
        assertThat(reservedInDubai(rep, "FZ-COLA-330-24")).isEqualTo(reservedBefore + 30);

        // A second approval is an invalid transition.
        mvc.perform(post("/api/orders/{id}/approve", orderId).header(HttpHeaders.AUTHORIZATION, bearer(manager)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("invalid-order-state"));

        // AI summary (mock provider): deterministic template, stored on the order.
        mvc.perform(post("/api/orders/{id}/ai-summary", orderId).header(HttpHeaders.AUTHORIZATION, bearer(rep)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.aiSummary", containsString("Risk: ")));
        mvc.perform(get("/api/orders/{id}", orderId).header(HttpHeaders.AUTHORIZATION, bearer(rep)))
                .andExpect(jsonPath("$.aiSummary", startsWith("- " + created.get("orderNo").asText())));

        // Cancel releases the reservation.
        mvc.perform(post("/api/orders/{id}/cancel", orderId).header(HttpHeaders.AUTHORIZATION, bearer(rep)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"));
        assertThat(reservedInDubai(rep, "FZ-COLA-330-24")).isEqualTo(reservedBefore);
    }

    @Test
    void unknownSkuIs422Problem() throws Exception {
        mvc.perform(post("/api/orders/quote").header(HttpHeaders.AUTHORIZATION, bearer(login("REP")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"outletId\": %d, \"lines\": [{\"sku\": \"XX-NOPE-1\", \"qtyCases\": 1}]}".formatted(CORNICHE)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.type").value("https://orderpilot.example/problems/invalid-sku"))
                .andExpect(jsonPath("$.title").isNotEmpty())
                .andExpect(jsonPath("$.detail", containsString("XX-NOPE-1")))
                .andExpect(jsonPath("$.unknownSkus[0]").value("XX-NOPE-1"));
    }

    @Test
    void insufficientStockIsWarningOnQuoteAnd409OnOrder() throws Exception {
        var rep = login("REP");
        // VoltX Tropical has only 8 cases in the Sharjah warehouse.
        var body = "{\"outletId\": %d, \"lines\": [{\"sku\": \"VX-TROP-500-12\", \"qtyCases\": 9}]}".formatted(AL_MAJAZ);

        mvc.perform(post("/api/orders/quote").header(HttpHeaders.AUTHORIZATION, bearer(rep))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lines[0].available").value(8))
                .andExpect(jsonPath("$.lines[0].fulfillable").value(false))
                .andExpect(jsonPath("$.warnings[0]", containsString("Only 8 of 9")));

        mvc.perform(post("/api/orders").header(HttpHeaders.AUTHORIZATION, bearer(rep))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isConflict())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.code").value("insufficient-stock"))
                .andExpect(jsonPath("$.shortfalls[0].available").value(8));
    }

    @Test
    void repeatedIdempotencyKeyReturnsTheOriginalOrder() throws Exception {
        var rep = login("REP");
        var body = "{\"outletId\": %d, \"lines\": [{\"sku\": \"PP-STIL-500-24\", \"qtyCases\": 5}]}".formatted(CORNICHE);

        var first = read(mvc.perform(post("/api/orders").header(HttpHeaders.AUTHORIZATION, bearer(rep))
                        .header("Idempotency-Key", "idem-test-1")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated())
                .andReturn());

        var second = read(mvc.perform(post("/api/orders").header(HttpHeaders.AUTHORIZATION, bearer(rep))
                        .header("Idempotency-Key", "idem-test-1")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(header().string("Idempotent-Replayed", "true"))
                .andReturn());

        assertThat(second.get("id")).isEqualTo(first.get("id"));
        assertThat(second.get("orderNo")).isEqualTo(first.get("orderNo"));

        mvc.perform(get("/api/orders").param("outletId", String.valueOf(CORNICHE)).param("status", "CONFIRMED")
                        .header(HttpHeaders.AUTHORIZATION, bearer(rep)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[?(@.orderNo == '%s')]".formatted(first.get("orderNo").asText())).exists());
    }

    @Test
    void invalidBodyIs400WithFieldErrors() throws Exception {
        mvc.perform(post("/api/orders/quote").header(HttpHeaders.AUTHORIZATION, bearer(login("REP")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"outletId\": 1, \"lines\": [{\"sku\": \"\", \"qtyCases\": 0}]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.length()").value(2));
    }

    @Test
    void unknownOrderIs404() throws Exception {
        mvc.perform(get("/api/orders/999999").header(HttpHeaders.AUTHORIZATION, bearer(login("REP"))))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("order-not-found"));
    }

    @Test
    void ordersAreListedNewestFirst() throws Exception {
        var page = read(mvc.perform(get("/api/orders").param("size", "5")
                        .header(HttpHeaders.AUTHORIZATION, bearer(login("MANAGER"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.size").value(5))
                .andExpect(jsonPath("$.number").value(0))
                .andReturn());
        var content = page.get("content");
        for (int i = 1; i < content.size(); i++) {
            assertThat(Instant.parse(content.get(i - 1).get("createdAt").asText()))
                    .isAfterOrEqualTo(Instant.parse(content.get(i).get("createdAt").asText()));
        }
        assertThat(page.get("totalElements").asLong()).isGreaterThanOrEqualTo(25);
    }

    private int reservedInDubai(String token, String sku) throws Exception {
        var product = read(mvc.perform(get("/api/products/{sku}", sku).header(HttpHeaders.AUTHORIZATION, bearer(token)))
                .andExpect(status().isOk()).andReturn());
        for (var stock : product.get("stock")) {
            if ("DXB".equals(stock.get("warehouse").asText())) {
                return stock.get("reservedCases").asInt();
            }
        }
        throw new AssertionError("no DXB stock for " + sku);
    }
}
