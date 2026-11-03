package com.orderpilot.core.config;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
class CoreConfig {

    /** Business clock in the distributor's time zone; "today" for promotions and dashboards follows it. */
    @Bean
    Clock clock(AppProperties properties) {
        return Clock.system(properties.business().timezone());
    }
}
