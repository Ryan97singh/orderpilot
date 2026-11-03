package com.orderpilot.core.ai;

import static com.orderpilot.core.ai.OrderFacts.money;

import com.orderpilot.core.domain.OrderStatus;
import com.orderpilot.core.domain.SalesOrder;
import org.springframework.stereotype.Component;

/** Deterministic summary used when no LLM is configured (LLM_PROVIDER=mock) or when the LLM call fails. */
@Component
public class TemplateSummarizer {

    public String summarize(SalesOrder order) {
        var facts = new OrderFacts(order);
        var outlet = order.getOutlet();
        var top = facts.largestLine();
        var risk = switch (facts.riskLevel()) {
            case "HIGH" -> order.getStatus() == OrderStatus.PENDING_APPROVAL
                    ? "HIGH - order exceeds the outlet's credit limit and is waiting for manager approval."
                    : "HIGH - credit utilisation would reach %d%% of the limit.".formatted(facts.creditUtilisationPct());
            case "MEDIUM" -> "MEDIUM - credit utilisation at %d%%; monitor collections before the next order."
                    .formatted(facts.creditUtilisationPct());
            default -> "LOW - credit utilisation at %d%% and all lines were fulfillable."
                    .formatted(facts.creditUtilisationPct());
        };
        return """
                - %s for %s (%s, %s): %d line(s), %d cases, total AED %s after AED %s in promotions.
                - Largest line: %s x %d cases (AED %s); %d line(s) carried a promotion.
                - Status %s, placed via %s by %s.
                Risk: %s""".formatted(
                order.getOrderNo(), outlet.getName(), outlet.getChannel(), outlet.getCity(),
                order.getLines().size(), facts.totalCases(), money(order.getTotal()), money(order.getDiscount()),
                top.getProductName(), top.getQtyCases(), money(top.getLineTotal()), facts.promotedLines(),
                order.getStatus(), order.getSource(), order.getCreatedBy(),
                risk);
    }
}
