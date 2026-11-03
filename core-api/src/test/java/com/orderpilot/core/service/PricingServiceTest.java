package com.orderpilot.core.service;

import static com.orderpilot.core.TestData.COLA;
import static com.orderpilot.core.TestData.LEMON;
import static com.orderpilot.core.TestData.TODAY;
import static com.orderpilot.core.TestData.WATER;
import static com.orderpilot.core.TestData.promotion;
import static com.orderpilot.core.TestData.stock;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import com.orderpilot.core.TestData;
import com.orderpilot.core.domain.Channel;
import com.orderpilot.core.domain.CreditDecision;
import com.orderpilot.core.domain.Promotion;
import com.orderpilot.core.domain.RuleViolationException;
import com.orderpilot.core.domain.Warehouse;
import com.orderpilot.core.repository.InventoryRepository;
import com.orderpilot.core.repository.ProductRepository;
import com.orderpilot.core.repository.PromotionRepository;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PricingServiceTest {

    // 5% for any channel from 10 cases; 8% for GROCERY from 25 cases; 12% for HORECA from 50 cases.
    private static final Promotion ALL_CHANNELS_5 = promotion(1, COLA.getSku(), null, "5.00", 10);
    private static final Promotion GROCERY_8 = promotion(2, COLA.getSku(), Channel.GROCERY, "8.00", 25);
    private static final Promotion HORECA_12 = promotion(3, COLA.getSku(), Channel.HORECA, "12.00", 50);

    @Mock
    ProductRepository products;
    @Mock
    InventoryRepository inventory;
    @Mock
    PromotionRepository promotions;

    PricingService pricing;

    @BeforeEach
    void setUp() {
        pricing = new PricingService(products, inventory, promotions, TestData.CLOCK);
        when(products.findAllById(anyCollection())).thenReturn(List.of(COLA, WATER, LEMON));
        when(inventory.findBySkusInWarehouse(anyCollection(), eq(Warehouse.DXB)))
                .thenReturn(List.of(stock(COLA, 500, 100), stock(WATER, 30, 10)));
        when(promotions.findValidOn(anyCollection(), any())).thenReturn(List.of(ALL_CHANNELS_5, GROCERY_8, HORECA_12));
    }

    @Nested
    class PromotionSelection {

        @ParameterizedTest(name = "{0} cases for a grocery outlet -> {1}%")
        @CsvSource({"9, 0.00", "10, 5.00", "24, 5.00", "25, 8.00", "200, 8.00"})
        void bestApplicablePromotionWinsAndMinCasesIsInclusive(int qty, String expectedPct) {
            var quote = pricing.quote(TestData.groceryInDubai("100000", "0"), List.of(new LineItem(COLA.getSku(), qty)));

            assertThat(quote.lines().getFirst().discountPct()).isEqualByComparingTo(expectedPct);
        }

        @Test
        void promotionForAnotherChannelIsIgnored() {
            var quote = pricing.quote(TestData.horecaInDubai(), List.of(new LineItem(COLA.getSku(), 30)));

            var line = quote.lines().getFirst();
            assertThat(line.promotion()).contains(ALL_CHANNELS_5);
            assertThat(line.discountPct()).isEqualByComparingTo("5.00");
        }

        @Test
        void channelSpecificPromotionBeatsGenericOneWhenItIsBetter() {
            var quote = pricing.quote(TestData.horecaInDubai(), List.of(new LineItem(COLA.getSku(), 50)));

            assertThat(quote.lines().getFirst().promotion()).contains(HORECA_12);
        }

        @Test
        void promotionsOutsideTheirValidityWindowNeverApply() {
            var expired = new Promotion(9L, COLA.getSku(), null, new BigDecimal("30"), 1,
                    TODAY.minusDays(30), TODAY.minusDays(1), "expired");
            var future = new Promotion(10L, COLA.getSku(), null, new BigDecimal("40"), 1,
                    TODAY.plusDays(1), TODAY.plusDays(30), "not started");

            var best = PricingService.bestPromotion(List.of(expired, future, ALL_CHANNELS_5), Channel.GROCERY, 10, TODAY);

            assertThat(best).contains(ALL_CHANNELS_5);
        }

        @Test
        void promotionValidOnItsFirstAndLastDay() {
            var oneDay = new Promotion(11L, COLA.getSku(), null, new BigDecimal("3"), 1, TODAY, TODAY, "today only");

            assertThat(PricingService.bestPromotion(List.of(oneDay), Channel.HORECA, 1, TODAY)).contains(oneDay);
        }
    }

    @Test
    void totalsAreRoundedToFils() {
        // 25 x 38.00 = 950.00, 8% = 76.00; 3 x 18.00 = 54.00, no promotion.
        var quote = pricing.quote(TestData.groceryInDubai("100000", "0"),
                List.of(new LineItem(COLA.getSku(), 25), new LineItem(WATER.getSku(), 3)));

        assertThat(quote.subtotal()).isEqualByComparingTo("1004.00");
        assertThat(quote.discount()).isEqualByComparingTo("76.00");
        assertThat(quote.total()).isEqualByComparingTo("928.00");
        assertThat(quote.lines()).extracting(PricedLine::lineTotal)
                .usingElementComparator(BigDecimal::compareTo)
                .containsExactly(new BigDecimal("874.00"), new BigDecimal("54.00"));
    }

    @Test
    void repeatedSkusAreMergedBeforePromotionsAreChecked() {
        var quote = pricing.quote(TestData.groceryInDubai("100000", "0"),
                List.of(new LineItem("fz-cola-330-24", 15), new LineItem(COLA.getSku(), 10)));

        assertThat(quote.lines()).singleElement().satisfies(line -> {
            assertThat(line.qtyCases()).isEqualTo(25);
            assertThat(line.discountPct()).isEqualByComparingTo("8.00");
        });
    }

    @Test
    void unknownAndInactiveSkusAreRejected() {
        assertThatThrownBy(() -> pricing.quote(TestData.groceryInDubai("100000", "0"),
                List.of(new LineItem("NOPE-1", 1), new LineItem(LEMON.getSku(), 1), new LineItem(COLA.getSku(), 1))))
                .isInstanceOfSatisfying(RuleViolationException.class, ex -> {
                    assertThat(ex.code()).isEqualTo("invalid-sku");
                    assertThat(ex.details()).containsEntry("unknownSkus", List.of("NOPE-1"))
                            .containsEntry("inactiveSkus", List.of(LEMON.getSku()));
                });
    }

    @Test
    void shortStockInTheOutletsWarehouseMarksTheLineUnfulfillable() {
        // WATER: 30 on hand, 10 reserved -> 20 available in DXB.
        var quote = pricing.quote(TestData.groceryInDubai("100000", "0"), List.of(new LineItem(WATER.getSku(), 21)));

        var line = quote.lines().getFirst();
        assertThat(line.availableCases()).isEqualTo(20);
        assertThat(line.fulfillable()).isFalse();
        assertThat(quote.fulfillable()).isFalse();
        assertThat(quote.warnings()).singleElement().asString().contains("Only 20 of 21 cases");
    }

    @Test
    void quoteOverTheCreditLimitNeedsApprovalAndWarns() {
        var outlet = TestData.groceryInDubai("1000.00", "900.00");

        var quote = pricing.quote(outlet, List.of(new LineItem(WATER.getSku(), 6)));

        assertThat(quote.credit()).isInstanceOf(CreditDecision.ExceedsLimit.class);
        assertThat(quote.credit().status()).isEqualTo("NEEDS_APPROVAL");
        assertThat(quote.warnings()).anyMatch(w -> w.contains("manager approval"));
    }
}
