package com.schemepredictor.config;

import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;

@Configuration
public class RestTemplateConfig {

    /**
     * Explicit timeouts matter here specifically because RecommendationService
     * treats "the ML service didn't answer" as a signal to fall back to
     * rule-based scoring. Without a timeout, a slow-but-not-down Python
     * service (e.g. cold-starting, or briefly overloaded) would hang the
     * request thread indefinitely instead of triggering that fallback.
     */
    @Bean
    public RestTemplate restTemplate(RestTemplateBuilder builder) {
        return builder
                .setConnectTimeout(Duration.ofSeconds(2))
                .setReadTimeout(Duration.ofSeconds(60))
                .build();
    }
}
