package com.orderpilot.core.ai;

import com.orderpilot.core.domain.SalesOrder;
import com.orderpilot.core.service.OrderService;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/**
 * Generates the 3-bullet + risk summary for an order with Spring AI's {@link ChatClient}. A missing provider or a
 * failed call never fails the request: the deterministic template is used and the reason is logged.
 */
@Service
public class OrderSummaryService {

    private static final Logger log = LoggerFactory.getLogger(OrderSummaryService.class);

    static final String SYSTEM_PROMPT = """
            You are a sales-operations assistant for a beverage distributor in the UAE (currency AED).
            Summarise the order for a sales manager using only the facts provided.
            Respond with exactly three markdown bullet points ("- "), each one sentence, then one final line that
            starts with "Risk: " followed by LOW, MEDIUM or HIGH and a short reason (credit, stock or pricing).
            Do not invent numbers, products or names.""";

    private final Optional<ChatClient> chatClient;
    private final String provider;
    private final TemplateSummarizer template;
    private final OrderService orders;

    public OrderSummaryService(ObjectProvider<ChatModel> chatModel, TemplateSummarizer template, OrderService orders,
                               @Value("${app.ai.effective-provider:mock}") String provider) {
        this.chatClient = Optional.ofNullable(chatModel.getIfAvailable())
                .map(model -> ChatClient.builder(model).defaultSystem(SYSTEM_PROMPT).build());
        this.provider = chatClient.isPresent() ? provider : LlmProvider.MOCK.id();
        this.template = template;
        this.orders = orders;
        log.info("Order summaries use provider '{}'", this.provider);
    }

    /** Loads the order, calls the model outside any transaction (no DB connection held), then stores the text. */
    public SalesOrder generateAndStore(long orderId) {
        var order = orders.get(orderId);
        var result = summarize(order);
        switch (result) {
            case SummaryResult.Generated g -> log.atInfo().addKeyValue("orderNo", order.getOrderNo())
                    .addKeyValue("provider", g.provider()).log("AI summary generated");
            case SummaryResult.Template t -> log.atInfo().addKeyValue("orderNo", order.getOrderNo())
                    .addKeyValue("reason", t.reason()).log("Template summary used");
        }
        return orders.attachAiSummary(orderId, result.text());
    }

    public SummaryResult summarize(SalesOrder order) {
        if (chatClient.isEmpty()) {
            return new SummaryResult.Template(template.summarize(order), "no LLM provider configured");
        }
        try {
            var content = chatClient.get().prompt()
                    .user(new OrderFacts(order).asPromptContext())
                    .call()
                    .content();
            if (!StringUtils.hasText(content)) {
                throw new IllegalStateException("model returned an empty summary");
            }
            return new SummaryResult.Generated(content.strip(), provider);
        } catch (RuntimeException e) {
            log.atWarn().addKeyValue("orderNo", order.getOrderNo()).addKeyValue("provider", provider)
                    .setCause(e).log("LLM summary failed; falling back to template: {}", e.getMessage());
            return new SummaryResult.Template(template.summarize(order), "LLM call failed: " + e.getMessage());
        }
    }

    public String provider() {
        return provider;
    }
}
