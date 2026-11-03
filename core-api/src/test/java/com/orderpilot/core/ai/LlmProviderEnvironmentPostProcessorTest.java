package com.orderpilot.core.ai;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.logging.DeferredLogs;
import org.springframework.mock.env.MockEnvironment;

class LlmProviderEnvironmentPostProcessorTest {

    @ParameterizedTest(name = "LLM_PROVIDER={0}, key={1} -> {2}")
    @CsvSource({
            "claude,       sk-test, anthropic,    claude",
            "claude,       '',      none,         mock",
            "azure_openai, key,     azure-openai, azure_openai",
            "azure_openai, '',      none,         mock",
            "mock,         sk-test, none,         mock"})
    void selectsOneSpringAiChatModelAndDegradesWithoutCredentials(String provider, String key, String chatModel,
                                                                   String effective) {
        var env = new MockEnvironment()
                .withProperty("app.ai.provider", provider)
                .withProperty("spring.ai.anthropic.api-key", key)
                .withProperty("spring.ai.azure.openai.api-key", key)
                .withProperty("spring.ai.azure.openai.endpoint", "https://example.openai.azure.com");

        new LlmProviderEnvironmentPostProcessor(new DeferredLogs()).postProcessEnvironment(env, new SpringApplication());

        assertThat(env.getProperty("spring.ai.model.chat")).isEqualTo(chatModel);
        assertThat(env.getProperty("app.ai.effective-provider")).isEqualTo(effective);
    }
}
