package com.orderpilot.core.api;

import com.orderpilot.core.ai.OrderSummaryService;
import com.orderpilot.core.api.dto.OrderDto;
import com.orderpilot.core.api.dto.PageResponse;
import com.orderpilot.core.api.dto.PlaceOrderRequest;
import com.orderpilot.core.api.dto.QuoteRequest;
import com.orderpilot.core.api.dto.QuoteResponse;
import com.orderpilot.core.domain.OrderStatus;
import com.orderpilot.core.security.CurrentUser;
import com.orderpilot.core.service.OrderService;
import com.orderpilot.core.service.PlaceOrderCommand;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import java.net.URI;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/orders")
@Tag(name = "Orders")
class OrderController {

    static final String IDEMPOTENCY_KEY = "Idempotency-Key";
    static final String REPLAYED = "Idempotent-Replayed";

    private final OrderService orders;
    private final OrderSummaryService summaries;

    OrderController(OrderService orders, OrderSummaryService summaries) {
        this.orders = orders;
        this.summaries = summaries;
    }

    @PostMapping("/quote")
    @PreAuthorize("hasAnyRole('REP', 'MANAGER')")
    @Operation(summary = "Price lines for an outlet: promotions, stock in the outlet's warehouse, credit status")
    QuoteResponse quote(@Valid @RequestBody QuoteRequest request) {
        return QuoteResponse.from(orders.quote(request.outletId(), request.lineItems()));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('REP', 'MANAGER')")
    @Operation(summary = "Place an order (201), or replay the original for a repeated Idempotency-Key (200)")
    ResponseEntity<OrderDto> place(@Valid @RequestBody PlaceOrderRequest request,
                                   @RequestHeader(name = IDEMPOTENCY_KEY, required = false) @Size(max = 100)
                                   String idempotencyKey,
                                   @AuthenticationPrincipal Jwt jwt) {
        var command = new PlaceOrderCommand(request.outletId(), request.lineItems(), request.notes(), request.source(),
                CurrentUser.from(jwt).id(), StringUtils.hasText(idempotencyKey) ? idempotencyKey.strip() : null);
        var placement = orders.place(command);
        var body = OrderDto.detail(placement.order());
        if (placement.replayed()) {
            return ResponseEntity.ok().header(REPLAYED, "true").body(body);
        }
        return ResponseEntity.created(URI.create("/api/orders/" + body.id())).body(body);
    }

    @GetMapping
    @Operation(summary = "List orders, newest first (page is zero-based)")
    PageResponse<OrderDto> list(@RequestParam(required = false) Long outletId,
                                @RequestParam(required = false) OrderStatus status,
                                @RequestParam(defaultValue = "0") @Min(0) int page,
                                @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        var pageable = PageRequest.of(page, size, Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id")));
        return PageResponse.from(orders.search(outletId, status, pageable), OrderDto::summary);
    }

    @GetMapping("/{id}")
    OrderDto get(@PathVariable long id) {
        return OrderDto.detail(orders.get(id));
    }

    @PostMapping("/{id}/approve")
    @PreAuthorize("hasRole('MANAGER')")
    @Operation(summary = "PENDING_APPROVAL -> CONFIRMED; reserves stock")
    OrderDto approve(@PathVariable long id) {
        return OrderDto.detail(orders.approve(id));
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasAnyRole('REP', 'MANAGER')")
    @Operation(summary = "Cancel a pending or confirmed order; releases reserved stock")
    OrderDto cancel(@PathVariable long id) {
        return OrderDto.detail(orders.cancel(id));
    }

    @PostMapping("/{id}/ai-summary")
    @Operation(summary = "Generate and store a 3-bullet summary plus risk note (Spring AI, template fallback)")
    OrderDto aiSummary(@PathVariable long id) {
        return OrderDto.detail(summaries.generateAndStore(id));
    }
}
