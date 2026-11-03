package com.orderpilot.core.ai;

import java.util.Locale;

/** {@code LLM_PROVIDER}: which Spring AI chat model backs order summaries. */
public enum LlmProvider {
    CLAUDE("anthropic"),
    AZURE_OPENAI("azure-openai"),
    MOCK("none");

    private final String springAiChatModel;

    LlmProvider(String springAiChatModel) {
        this.springAiChatModel = springAiChatModel;
    }

    /** Value for {@code spring.ai.model.chat}, which selects exactly one Spring AI chat auto-configuration. */
    public String springAiChatModel() {
        return springAiChatModel;
    }

    public String id() {
        return name().toLowerCase(Locale.ROOT);
    }

    public static LlmProvider parse(String value) {
        if (value == null || value.isBlank()) {
            return MOCK;
        }
        return switch (value.strip().toLowerCase(Locale.ROOT).replace('-', '_')) {
            case "claude", "anthropic" -> CLAUDE;
            case "azure_openai", "azure" -> AZURE_OPENAI;
            case "mock", "none" -> MOCK;
            default -> throw new IllegalArgumentException(
                    "Unknown LLM_PROVIDER '%s' (expected claude, azure_openai or mock)".formatted(value));
        };
    }
}
