package com.orderpilot.core.api;

import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;

class CatalogApiTest extends ApiTestSupport {

    @Test
    void outletSearchIsCaseInsensitiveContainsOnNameCodeAndCity() throws Exception {
        var token = bearer(login("REP"));
        mvc.perform(get("/api/outlets").header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(12));
        mvc.perform(get("/api/outlets").param("q", "ABU dhabi").header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(jsonPath("$.length()").value(4))
                .andExpect(jsonPath("$[*].warehouse", everyItem(is("AUH"))));
        mvc.perform(get("/api/outlets").param("q", "out-1012").header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(jsonPath("$[0].name").value("Sharjah Value Hypermarket"));
        mvc.perform(get("/api/outlets").param("q", "%").header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void outletDetailIncludesAvailableCredit() throws Exception {
        mvc.perform(get("/api/outlets/5").header(HttpHeaders.AUTHORIZATION, bearer(login("REP"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("OUT-1005"))
                .andExpect(jsonPath("$.availableCredit").isNumber());
    }

    @Test
    void productSearchFiltersByTextAndCategoryAndHidesInactiveProducts() throws Exception {
        var token = bearer(login("REP"));
        mvc.perform(get("/api/products").header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(jsonPath("$.length()").value(15));
        mvc.perform(get("/api/products").param("q", "voltx").header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(jsonPath("$.length()").value(3));
        mvc.perform(get("/api/products").param("category", "WATER").header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(jsonPath("$[*].category", everyItem(is("WATER"))))
                .andExpect(jsonPath("$[0].stock.length()").value(3));
        mvc.perform(get("/api/products").param("q", "lemon").header(HttpHeaders.AUTHORIZATION, token))
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void productDetailHasStockPerWarehouseAndTodaysPromotions() throws Exception {
        mvc.perform(get("/api/products/fz-cola-330-24").header(HttpHeaders.AUTHORIZATION, bearer(login("REP"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.stock.length()").value(3))
                .andExpect(jsonPath("$.stock[0].availableCases").isNumber())
                .andExpect(jsonPath("$.promotions.length()", greaterThanOrEqualTo(2)));
        mvc.perform(get("/api/products/NOPE").header(HttpHeaders.AUTHORIZATION, bearer(login("REP"))))
                .andExpect(status().isNotFound());
    }
}
