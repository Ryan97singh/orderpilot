package com.orderpilot.core.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.orderpilot.core.TestData;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class CreditDecisionTest {

    private final Outlet outlet = TestData.groceryInDubai("50000.00", "45000.00");

    @Test
    void orderWithinCreditIsConfirmed() {
        var decision = CreditDecision.evaluate(outlet, new BigDecimal("4999.99"));

        assertThat(decision).isInstanceOf(CreditDecision.WithinLimit.class);
        assertThat(decision.status()).isEqualTo("OK");
        assertThat(decision.initialOrderStatus()).isEqualTo(OrderStatus.CONFIRMED);
    }

    @Test
    void orderLandingExactlyOnTheLimitIsStillConfirmed() {
        var decision = CreditDecision.evaluate(outlet, new BigDecimal("5000.00"));

        assertThat(decision).isEqualTo(new CreditDecision.WithinLimit(new BigDecimal("0.00")));
        assertThat(decision.initialOrderStatus()).isEqualTo(OrderStatus.CONFIRMED);
    }

    @Test
    void orderOverTheLimitNeedsManagerApproval() {
        var decision = CreditDecision.evaluate(outlet, new BigDecimal("5000.01"));

        assertThat(decision).isEqualTo(new CreditDecision.ExceedsLimit(new BigDecimal("0.01")));
        assertThat(decision.status()).isEqualTo("NEEDS_APPROVAL");
        assertThat(decision.initialOrderStatus()).isEqualTo(OrderStatus.PENDING_APPROVAL);
    }
}
