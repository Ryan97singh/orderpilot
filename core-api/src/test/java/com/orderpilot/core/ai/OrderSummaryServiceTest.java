package com.orderpilot.core.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.orderpilot.core.TestData;
import com.orderpilot.core.domain.OrderSource;
import com.orderpilot.core.domain.OrderStatus;
import com.orderpilot.core.domain.SalesOrder;
import com.orderpilot.core.service.OrderService;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.support.StaticListableBeanFactory;

class OrderSummaryServiceTest {

    private final SalesOrder order = pendingOrder();

    @Test
    void withoutChatModelTheDeterministicTemplateIsUsed() {
        var service = new OrderSummaryService(providerOf(null), new TemplateSummarizer(), mock(OrderService.class), "mock");

        var result = service.summarize(order);

        assertThat(service.provider()).isEqualTo("mock");
        assertThat(result).isInstanceOf(SummaryResult.Template.class);
        assertThat(result.text().lines()).hasSize(4);
        assertThat(result.text()).startsWith("- SO-2026-00099 for Test Grocery")
                .contains("Risk: HIGH - order exceeds the outlet's credit limit");
        assertThat(service.summarize(order).text()).isEqualTo(result.text());
    }

    @Test
    void chatModelOutputIsReturnedWhenTheCallSucceeds() {
        var model = mock(ChatModel.class);
        when(model.call(any(Prompt.class))).thenReturn(new ChatResponse(List.of(
                new Generation(new AssistantMessage("- one\n- two\n- three\nRisk: HIGH - over credit")))));
        var service = new OrderSummaryService(providerOf(model), new TemplateSummarizer(), mock(OrderService.class), "claude");

        var result = service.summarize(order);

        assertThat(result).isEqualTo(new SummaryResult.Generated("- one\n- two\n- three\nRisk: HIGH - over credit", "claude"));
    }

    @Test
    void llmFailureFallsBackToTheTemplateInsteadOfFailing() {
        var model = mock(ChatModel.class);
        when(model.call(any(Prompt.class))).thenThrow(new IllegalStateException("529 overloaded"));
        var service = new OrderSummaryService(providerOf(model), new TemplateSummarizer(), mock(OrderService.class), "claude");

        var result = service.summarize(order);

        assertThat(result).isInstanceOfSatisfying(SummaryResult.Template.class,
                t -> assertThat(t.reason()).contains("529 overloaded"));
        assertThat(result.text()).contains("Risk: ");
    }

    private static ObjectProvider<ChatModel> providerOf(ChatModel model) {
        var beans = new StaticListableBeanFactory();
        if (model != null) {
            beans.addBean("chatModel", model);
        }
        return beans.getBeanProvider(ChatModel.class);
    }

    private static SalesOrder pendingOrder() {
        var order = new SalesOrder("SO-2026-00099", TestData.groceryInDubai("1000", "900"), OrderStatus.PENDING_APPROVAL,
                OrderSource.AI_AGENT, "rep-001", Instant.parse("2026-11-03T06:00:00Z"), null, null);
        order.addLine("FZ-COLA-330-24", "FizzUp Cola 330ml Can", 10, new BigDecimal("38.00"), new BigDecimal("5.00"),
                new BigDecimal("19.00"), new BigDecimal("361.00"));
        return order;
    }
}
