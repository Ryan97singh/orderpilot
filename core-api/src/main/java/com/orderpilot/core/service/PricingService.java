package com.orderpilot.core.service;

import static java.util.stream.Collectors.groupingBy;
import static java.util.stream.Collectors.toMap;

import com.orderpilot.core.domain.Channel;
import com.orderpilot.core.domain.CreditDecision;
import com.orderpilot.core.domain.Inventory;
import com.orderpilot.core.domain.Outlet;
import com.orderpilot.core.domain.Product;
import com.orderpilot.core.domain.Promotion;
import com.orderpilot.core.domain.RuleViolationException;
import com.orderpilot.core.repository.InventoryRepository;
import com.orderpilot.core.repository.ProductRepository;
import com.orderpilot.core.repository.PromotionRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Prices order lines for an outlet. Quote and order placement share this so they can never disagree. */
@Service
public class PricingService {

    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    private final ProductRepository products;
    private final InventoryRepository inventory;
    private final PromotionRepository promotions;
    private final Clock clock;

    public PricingService(ProductRepository products, InventoryRepository inventory, PromotionRepository promotions,
                          Clock clock) {
        this.products = products;
        this.inventory = inventory;
        this.promotions = promotions;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public Quote quote(Outlet outlet, List<LineItem> requested) {
        var lines = consolidate(requested);
        var skus = lines.keySet();
        var catalog = products.findAllById(skus).stream().collect(toMap(Product::getSku, Function.identity()));
        requireOrderable(skus, catalog);

        var today = LocalDate.now(clock);
        var warehouse = outlet.warehouse();
        var stock = inventory.findBySkusInWarehouse(skus, warehouse).stream()
                .collect(toMap(Inventory::getSku, Inventory::availableCases));
        var promotionsBySku = promotions.findValidOn(skus, today).stream().collect(groupingBy(Promotion::getSku));

        var priced = new ArrayList<PricedLine>();
        var warnings = new ArrayList<String>();
        var subtotal = BigDecimal.ZERO;
        var discount = BigDecimal.ZERO;

        for (var entry : lines.entrySet()) {
            var product = catalog.get(entry.getKey());
            int qty = entry.getValue();
            var promotion = bestPromotion(promotionsBySku.getOrDefault(product.getSku(), List.of()),
                    outlet.getChannel(), qty, today);
            var pct = promotion.map(Promotion::getDiscountPct).orElse(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
            var gross = money(product.getCasePrice().multiply(BigDecimal.valueOf(qty)));
            var lineDiscount = money(gross.multiply(pct).divide(HUNDRED, 4, RoundingMode.HALF_UP));
            int available = stock.getOrDefault(product.getSku(), 0);

            var line = new PricedLine(product, qty, money(product.getCasePrice()), promotion, pct, lineDiscount,
                    gross.subtract(lineDiscount), warehouse, available);
            if (!line.fulfillable()) {
                warnings.add("Only %d of %d cases of %s (%s) are available in %s"
                        .formatted(Math.max(available, 0), qty, product.getName(), product.getSku(), warehouse));
            }
            priced.add(line);
            subtotal = subtotal.add(gross);
            discount = discount.add(lineDiscount);
        }

        var total = subtotal.subtract(discount);
        var credit = CreditDecision.evaluate(outlet, total);
        if (credit instanceof CreditDecision.ExceedsLimit(var over)) {
            warnings.add("Order total AED %s exceeds %s's available credit (AED %s) by AED %s; it will need manager approval"
                    .formatted(plain(total), outlet.getName(), plain(outlet.availableCredit()), plain(over)));
        }
        return new Quote(outlet, priced, subtotal, discount, total, credit, warnings);
    }

    /** Business rule 2: of the promotions that apply, the highest discount wins. */
    static Optional<Promotion> bestPromotion(Collection<Promotion> candidates, Channel channel, int qtyCases,
                                             LocalDate day) {
        return candidates.stream()
                .filter(promotion -> promotion.appliesTo(channel, qtyCases, day))
                .max(Comparator.comparing(Promotion::getDiscountPct)
                        .thenComparing(Promotion::getMinCases, Comparator.reverseOrder()));
    }

    /** Normalises SKUs and merges repeated SKUs into one line, keeping the caller's order. */
    private static Map<String, Integer> consolidate(List<LineItem> requested) {
        var lines = new LinkedHashMap<String, Integer>();
        for (var item : requested) {
            lines.merge(item.sku().strip().toUpperCase(Locale.ROOT), item.qtyCases(), Integer::sum);
        }
        return lines;
    }

    private static void requireOrderable(Collection<String> skus, Map<String, Product> catalog) {
        var unknown = skus.stream().filter(sku -> !catalog.containsKey(sku)).toList();
        var inactive = skus.stream().filter(catalog::containsKey).filter(sku -> !catalog.get(sku).isActive()).toList();
        if (!unknown.isEmpty() || !inactive.isEmpty()) {
            throw RuleViolationException.unknownOrInactiveSkus(unknown, inactive);
        }
    }

    private static BigDecimal money(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    private static String plain(BigDecimal value) {
        return money(value).toPlainString();
    }
}
