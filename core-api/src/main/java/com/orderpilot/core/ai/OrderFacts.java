package com.orderpilot.core.ai;

import com.orderpilot.core.domain.OrderLine;
import com.orderpilot.core.domain.OrderStatus;
import com.orderpilot.core.domain.SalesOrder;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Comparator;
import java.util.Locale;
import java.util.stream.Collectors;

/** The facts about an order that both the LLM prompt and the template summary are built from. */
record OrderFacts(SalesOrder order) {

    int totalCases() {
        return order.getLines().stream().mapToInt(OrderLine::getQtyCases).sum();
    }

    long promotedLines() {
        return order.getLines().stream().filter(l -> l.getDiscountPct().signum() > 0).count();
    }

    OrderLine largestLine() {
        return order.getLines().stream().max(Comparator.comparing(OrderLine::getLineTotal)).orElseThrow();
    }

    /** Outstanding balance plus this order, as a share of the credit limit. */
    int creditUtilisationPct() {
        var outlet = order.getOutlet();
        if (outlet.getCreditLimit().signum() == 0) {
            return 100;
        }
        return outlet.getOutstandingBalance().add(order.getTotal())
                .multiply(BigDecimal.valueOf(100))
                .divide(outlet.getCreditLimit(), 0, RoundingMode.HALF_UP)
                .intValue();
    }

    String riskLevel() {
        int utilisation = creditUtilisationPct();
        if (order.getStatus() == OrderStatus.PENDING_APPROVAL || utilisation > 100) {
            return "HIGH";
        }
        return utilisation >= 80 ? "MEDIUM" : "LOW";
    }

    /** Plain-text fact sheet handed to the model; no free-form user input is included. */
    String asPromptContext() {
        var outlet = order.getOutlet();
        var lines = order.getLines().stream()
                .map(l -> "- %s (%s): %d cases x AED %s, discount %s%%, line total AED %s".formatted(
                        l.getProductName(), l.getSku(), l.getQtyCases(), money(l.getUnitPrice()),
                        l.getDiscountPct().stripTrailingZeros().toPlainString(), money(l.getLineTotal())))
                .collect(Collectors.joining("\n"));
        return """
                Order: %s, status %s, source %s, created by %s at %s
                Outlet: %s (%s), channel %s, city %s
                Credit: limit AED %s, outstanding AED %s, utilisation after this order %d%%
                Totals: subtotal AED %s, discount AED %s, total AED %s
                Lines:
                %s
                Notes: %s
                """.formatted(order.getOrderNo(), order.getStatus(), order.getSource(), order.getCreatedBy(),
                order.getCreatedAt(), outlet.getName(), outlet.getCode(), outlet.getChannel(), outlet.getCity(),
                money(outlet.getCreditLimit()), money(outlet.getOutstandingBalance()), creditUtilisationPct(),
                money(order.getSubtotal()), money(order.getDiscount()), money(order.getTotal()), lines,
                order.getNotes() == null ? "none" : order.getNotes());
    }

    static String money(BigDecimal value) {
        return String.format(Locale.US, "%,.2f", value);
    }
}
