package com.orderpilot.core.ai;

import java.util.Map;
import org.apache.commons.logging.Log;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.boot.logging.DeferredLogFactory;
import org.springframework.core.Ordered;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;
import org.springframework.util.StringUtils;

/**
 * Translates {@code LLM_PROVIDER} into Spring AI's {@code spring.ai.model.chat} switch before auto-configuration runs.
 * Only the selected provider's chat model is created, and a provider without credentials degrades to {@code none}
 * so the application always starts and falls back to template summaries.
 */
public class LlmProviderEnvironmentPostProcessor implements EnvironmentPostProcessor, Ordered {

    static final String CHAT_MODEL_PROPERTY = "spring.ai.model.chat";
    static final String EFFECTIVE_PROVIDER_PROPERTY = "app.ai.effective-provider";

    private final Log log;

    public LlmProviderEnvironmentPostProcessor(DeferredLogFactory logFactory) {
        this.log = logFactory.getLog(LlmProviderEnvironmentPostProcessor.class);
    }

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment env, SpringApplication application) {
        var requested = LlmProvider.parse(env.getProperty("app.ai.provider"));
        var effective = switch (requested) {
            case CLAUDE -> hasText(env, "spring.ai.anthropic.api-key") ? requested : LlmProvider.MOCK;
            case AZURE_OPENAI -> hasText(env, "spring.ai.azure.openai.endpoint")
                    && hasText(env, "spring.ai.azure.openai.api-key") ? requested : LlmProvider.MOCK;
            case MOCK -> LlmProvider.MOCK;
        };
        if (effective != requested) {
            log.warn("LLM_PROVIDER=%s but its credentials are missing; using template summaries".formatted(requested.id()));
        }
        var chatModel = env.containsProperty(CHAT_MODEL_PROPERTY)
                ? env.getProperty(CHAT_MODEL_PROPERTY)
                : effective.springAiChatModel();
        env.getPropertySources().addFirst(new MapPropertySource("orderpilot-llm-provider", Map.of(
                CHAT_MODEL_PROPERTY, chatModel,
                EFFECTIVE_PROVIDER_PROPERTY, effective.id())));
    }

    private static boolean hasText(ConfigurableEnvironment env, String key) {
        return StringUtils.hasText(env.getProperty(key));
    }

    @Override
    public int getOrder() {
        return Ordered.LOWEST_PRECEDENCE;
    }
}
