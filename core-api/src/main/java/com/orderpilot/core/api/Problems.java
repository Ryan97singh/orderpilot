package com.orderpilot.core.api;

import com.orderpilot.core.config.RequestIdFilter;
import java.net.URI;
import org.slf4j.MDC;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;

/** Builds RFC 7807 problems with a stable {@code type} URI, a machine-readable {@code code} and the request id. */
public final class Problems {

    public static final String TYPE_BASE = "https://orderpilot.example/problems/";

    private Problems() {
    }

    public static ProblemDetail of(HttpStatus status, String code, String title, String detail) {
        var problem = ProblemDetail.forStatusAndDetail(status, detail);
        problem.setType(URI.create(TYPE_BASE + code));
        problem.setTitle(title);
        problem.setProperty("code", code);
        return withRequestId(problem);
    }

    public static ProblemDetail forbidden() {
        return of(HttpStatus.FORBIDDEN, "forbidden", "Forbidden", "Your role is not allowed to perform this action");
    }

    public static ProblemDetail withRequestId(ProblemDetail problem) {
        var requestId = MDC.get(RequestIdFilter.MDC_KEY);
        if (requestId != null) {
            problem.setProperty("requestId", requestId);
        }
        return problem;
    }
}
