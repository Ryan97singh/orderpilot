package com.orderpilot.core.service;

import static com.orderpilot.core.TestData.COLA;
import static com.orderpilot.core.TestData.stock;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.orderpilot.core.TestData;
import com.orderpilot.core.domain.ConflictException;
import com.orderpilot.core.domain.Inventory;
import com.orderpilot.core.domain.OrderSource;
import com.orderpilot.core.domain.OrderStatus;
import com.orderpilot.core.domain.Outlet;
import com.orderpilot.core.domain.SalesOrder;
import com.orderpilot.core.repository.InventoryRepository;
import com.orderpilot.core.repository.OrderNumberGenerator;
import com.orderpilot.core.repository.OutletRepository;
import com.orderpilot.core.repository.ProductRepository;
import com.orderpilot.core.repository.PromotionRepository;
import com.orderpilot.core.repository.SalesOrderRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class OrderServiceTest {

    private static final long OUTLET_ID = 7L;

    @Mock
    OutletRepository outlets;
    @Mock
    SalesOrderRepository orders;
    @Mock
    InventoryRepository inventory;
    @Mock
    ProductRepository products;
    @Mock
    PromotionRepository promotions;
    @Mock
    OrderNumberGenerator orderNumbers;

    Inventory colaStock;
    OrderService service;

    @BeforeEach
    void setUp() {
        var pricing = new PricingService(products, inventory, promotions, TestData.CLOCK);
        var transaction = new TransactionTemplate(mock(PlatformTransactionManager.class));
        service = new OrderService(outlets, orders, inventory, pricing, orderNumbers, transaction, TestData.CLOCK);

        colaStock = stock(COLA, 100, 20); // 80 available
        when(products.findAllById(anyCollection())).thenReturn(List.of(COLA));
        when(inventory.findBySkusInWarehouse(anyCollection(), any())).thenReturn(List.of(colaStock));
        when(promotions.findValidOn(anyCollection(), any())).thenReturn(List.of());
        when(orderNumbers.next(anyInt())).thenReturn("SO-2026-00042");
        when(orders.saveAndFlush(any(SalesOrder.class))).thenAnswer(call -> call.getArgument(0));
    }

    @Test
    void orderWithinCreditIsConfirmedAndReservesStock() {
        givenOutlet(TestData.groceryInDubai("50000", "1000"));

        var placement = service.place(command(10, null));

        var order = placement.order();
        assertThat(placement.replayed()).isFalse();
        assertThat(order.getStatus()).isEqualTo(OrderStatus.CONFIRMED);
        assertThat(order.getOrderNo()).isEqualTo("SO-2026-00042");
        assertThat(order.getTotal()).isEqualByComparingTo("380.00");
        assertThat(order.getCreatedBy()).isEqualTo("rep-001");
        assertThat(colaStock.getReservedCases()).isEqualTo(30);
    }

    @Test
    void orderOverCreditIsPendingApprovalAndReservesNothing() {
        givenOutlet(TestData.groceryInDubai("1000", "900"));

        var order = service.place(command(10, null)).order();

        assertThat(order.getStatus()).isEqualTo(OrderStatus.PENDING_APPROVAL);
        assertThat(colaStock.getReservedCases()).isEqualTo(20);
    }

    @Test
    void insufficientStockIsRejectedWithConflict() {
        givenOutlet(TestData.groceryInDubai("50000", "0"));

        assertThatThrownBy(() -> service.place(command(81, null)))
                .isInstanceOfSatisfying(ConflictException.class, ex -> {
                    assertThat(ex.code()).isEqualTo("insufficient-stock");
                    assertThat(ex.getMessage()).contains("requested 81, available 80 in DXB");
                });
        verify(orders, never()).saveAndFlush(any());
        assertThat(colaStock.getReservedCases()).isEqualTo(20);
    }

    @Test
    void repeatedIdempotencyKeyReturnsTheOriginalOrderWithoutRepricing() {
        var original = existingOrder(OrderStatus.CONFIRMED);
        when(orders.findByIdempotencyKey("key-1")).thenReturn(Optional.of(original));

        var placement = service.place(command(10, "key-1"));

        assertThat(placement.replayed()).isTrue();
        assertThat(placement.order()).isSameAs(original);
        verifyNoInteractions(outlets, products, orderNumbers);
        verify(orders, never()).saveAndFlush(any());
    }

    @Test
    void concurrentDuplicateKeyFallsBackToTheWinningOrder() {
        givenOutlet(TestData.groceryInDubai("50000", "0"));
        var winner = existingOrder(OrderStatus.CONFIRMED);
        when(orders.findByIdempotencyKey("key-2")).thenReturn(Optional.empty(), Optional.of(winner));
        when(orders.saveAndFlush(any(SalesOrder.class))).thenThrow(new DataIntegrityViolationException("uk_sales_order_idem"));

        var placement = service.place(command(5, "key-2"));

        assertThat(placement.replayed()).isTrue();
        assertThat(placement.order()).isSameAs(winner);
    }

    @Test
    void approvingPendingOrderConfirmsItAndReservesStock() {
        var pending = existingOrder(OrderStatus.PENDING_APPROVAL);
        when(orders.findWithLinesById(1L)).thenReturn(Optional.of(pending));

        var approved = service.approve(1L);

        assertThat(approved.getStatus()).isEqualTo(OrderStatus.CONFIRMED);
        assertThat(colaStock.getReservedCases()).isEqualTo(32);
    }

    @Test
    void onlyPendingOrdersCanBeApproved() {
        when(orders.findWithLinesById(1L)).thenReturn(Optional.of(existingOrder(OrderStatus.CONFIRMED)));

        assertThatThrownBy(() -> service.approve(1L))
                .isInstanceOfSatisfying(ConflictException.class,
                        ex -> assertThat(ex.code()).isEqualTo("invalid-order-state"));
    }

    @Test
    void cancellingConfirmedOrderReleasesItsStock() {
        when(orders.findWithLinesById(1L)).thenReturn(Optional.of(existingOrder(OrderStatus.CONFIRMED)));

        var cancelled = service.cancel(1L);

        assertThat(cancelled.getStatus()).isEqualTo(OrderStatus.CANCELLED);
        assertThat(colaStock.getReservedCases()).isEqualTo(8);
    }

    @Test
    void cancellingPendingOrderLeavesStockAlone() {
        when(orders.findWithLinesById(1L)).thenReturn(Optional.of(existingOrder(OrderStatus.PENDING_APPROVAL)));

        service.cancel(1L);

        assertThat(colaStock.getReservedCases()).isEqualTo(20);
    }

    private void givenOutlet(Outlet outlet) {
        when(outlets.findById(OUTLET_ID)).thenReturn(Optional.of(outlet));
    }

    private static PlaceOrderCommand command(int qty, String idempotencyKey) {
        return new PlaceOrderCommand(OUTLET_ID, List.of(new LineItem(COLA.getSku(), qty)), null, OrderSource.AI_AGENT,
                "rep-001", idempotencyKey);
    }

    /** An existing order for 12 cases of cola. */
    private static SalesOrder existingOrder(OrderStatus status) {
        var order = new SalesOrder("SO-2026-00001", TestData.groceryInDubai("50000", "0"), status, OrderSource.UI,
                "rep-001", Instant.parse("2026-11-01T06:00:00Z"), null, null);
        order.addLine(COLA.getSku(), COLA.getName(), 12, new BigDecimal("38.00"), BigDecimal.ZERO, BigDecimal.ZERO,
                new BigDecimal("456.00"));
        return order;
    }
}
