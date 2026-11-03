package com.orderpilot.core.repository;

import jakarta.persistence.EntityManagerFactory;
import org.hibernate.engine.spi.SessionFactoryImplementor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Human-friendly order numbers ({@code SO-2026-00042}) backed by the {@code order_no_seq} database sequence.
 * The dialect renders the right "next value" syntax for H2, PostgreSQL and SQL Server.
 */
@Component
public class OrderNumberGenerator {

    private final JdbcTemplate jdbc;
    private final String nextValueSql;

    public OrderNumberGenerator(JdbcTemplate jdbc, EntityManagerFactory entityManagerFactory) {
        this.jdbc = jdbc;
        this.nextValueSql = entityManagerFactory.unwrap(SessionFactoryImplementor.class)
                .getJdbcServices().getDialect().getSequenceSupport()
                .getSequenceNextValString("order_no_seq");
    }

    public String next(int year) {
        Long value = jdbc.queryForObject(nextValueSql, Long.class);
        return "SO-%d-%05d".formatted(year, value);
    }
}
