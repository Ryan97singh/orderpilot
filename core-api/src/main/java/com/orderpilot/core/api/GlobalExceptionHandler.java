package com.orderpilot.core.api;

import com.orderpilot.core.domain.ConflictException;
import com.orderpilot.core.domain.DomainException;
import com.orderpilot.core.domain.NotFoundException;
import com.orderpilot.core.domain.RuleViolationException;
import java.net.URI;
import java.util.Locale;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.lang.Nullable;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

/** Every error leaves the API as {@code application/problem+json}. */
@RestControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(DomainException.class)
    ProblemDetail handleDomain(DomainException ex) {
        var status = switch (ex) {
            case NotFoundException e -> HttpStatus.NOT_FOUND;
            case RuleViolationException e -> HttpStatus.UNPROCESSABLE_ENTITY;
            case ConflictException e -> HttpStatus.CONFLICT;
        };
        var problem = Problems.of(status, ex.code(), status.getReasonPhrase(), ex.getMessage());
        ex.details().forEach(problem::setProperty);
        log.atInfo().addKeyValue("problem", ex.code()).log("Request rejected: {}", ex.getMessage());
        return problem;
    }

    @ExceptionHandler(ObjectOptimisticLockingFailureException.class)
    ProblemDetail handleOptimisticLock(ObjectOptimisticLockingFailureException ex) {
        return handleDomain(ConflictException.concurrentUpdate());
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    ProblemDetail handleDataIntegrity(DataIntegrityViolationException ex) {
        log.warn("Data integrity violation: {}", ex.getMostSpecificCause().getMessage());
        return Problems.of(HttpStatus.CONFLICT, "data-conflict", "Conflict",
                "The request conflicts with existing data");
    }

    /** Method-security denials ({@code @PreAuthorize}) surface here rather than in the security filter chain. */
    @ExceptionHandler(AccessDeniedException.class)
    ProblemDetail handleAccessDenied(AccessDeniedException ex) {
        return Problems.forbidden();
    }

    @ExceptionHandler(Exception.class)
    ProblemDetail handleUnexpected(Exception ex) {
        log.error("Unhandled error", ex);
        return Problems.of(HttpStatus.INTERNAL_SERVER_ERROR, "internal-error", "Internal Server Error",
                "Something went wrong; quote the requestId when reporting this");
    }

    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(MethodArgumentNotValidException ex,
                                                                  HttpHeaders headers, HttpStatusCode status,
                                                                  WebRequest request) {
        var problem = Problems.of(HttpStatus.BAD_REQUEST, "validation-failed", "Bad Request",
                "Request validation failed");
        problem.setProperty("errors", ex.getBindingResult().getFieldErrors().stream()
                .map(error -> Map.of("field", error.getField(),
                        "message", String.valueOf(error.getDefaultMessage())))
                .toList());
        return ResponseEntity.badRequest().body(problem);
    }

    /** Adds the problem {@code type}, {@code code} and request id to problems produced by Spring MVC itself. */
    @Override
    protected ResponseEntity<Object> handleExceptionInternal(Exception ex, @Nullable Object body, HttpHeaders headers,
                                                             HttpStatusCode statusCode, WebRequest request) {
        if (body instanceof ProblemDetail problem) {
            if (problem.getType() == null || "about:blank".equals(problem.getType().toString())) {
                var code = HttpStatus.resolve(statusCode.value()) instanceof HttpStatus status
                        ? status.name().toLowerCase(Locale.ROOT).replace('_', '-')
                        : "error";
                problem.setType(URI.create(Problems.TYPE_BASE + code));
                problem.setProperty("code", code);
            }
            Problems.withRequestId(problem);
        }
        return super.handleExceptionInternal(ex, body, headers, statusCode, request);
    }
}
