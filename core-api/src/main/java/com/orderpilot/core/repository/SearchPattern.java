package com.orderpilot.core.repository;

import java.util.Locale;
import org.springframework.util.StringUtils;

/**
 * Builds a lower-case {@code LIKE} pattern for "contains" searches, escaping wildcards in user input. A blank query
 * matches everything; never passing {@code null} keeps the SQL portable (PostgreSQL cannot type a null parameter
 * inside {@code lower()}).
 */
public final class SearchPattern {

    private SearchPattern() {
    }

    public static String contains(String query) {
        if (!StringUtils.hasText(query)) {
            return "%";
        }
        var escaped = query.strip().toLowerCase(Locale.ROOT)
                .replace("\\", "\\\\")
                .replace("%", "\\%")
                .replace("_", "\\_");
        return "%" + escaped + "%";
    }
}
