package com.orderpilot.core;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class OrderPilotApplication {

    public static void main(String[] args) {
        SpringApplication.run(OrderPilotApplication.class, args);
    }
}
