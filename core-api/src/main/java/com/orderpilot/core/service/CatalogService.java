package com.orderpilot.core.service;

import static java.util.stream.Collectors.groupingBy;

import com.orderpilot.core.domain.Category;
import com.orderpilot.core.domain.Inventory;
import com.orderpilot.core.domain.NotFoundException;
import com.orderpilot.core.domain.Outlet;
import com.orderpilot.core.domain.Product;
import com.orderpilot.core.domain.Promotion;
import com.orderpilot.core.repository.InventoryRepository;
import com.orderpilot.core.repository.OutletRepository;
import com.orderpilot.core.repository.ProductRepository;
import com.orderpilot.core.repository.PromotionRepository;
import com.orderpilot.core.repository.SearchPattern;
import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class CatalogService {

    private final OutletRepository outlets;
    private final ProductRepository products;
    private final InventoryRepository inventory;
    private final PromotionRepository promotions;
    private final Clock clock;

    public CatalogService(OutletRepository outlets, ProductRepository products, InventoryRepository inventory,
                          PromotionRepository promotions, Clock clock) {
        this.outlets = outlets;
        this.products = products;
        this.inventory = inventory;
        this.promotions = promotions;
        this.clock = clock;
    }

    public List<Outlet> searchOutlets(String q) {
        return outlets.search(SearchPattern.contains(q));
    }

    public Outlet getOutlet(long id) {
        return outlets.findById(id).orElseThrow(() -> NotFoundException.outlet(id));
    }

    public List<ProductView> searchProducts(String q, Category category) {
        var pattern = SearchPattern.contains(q);
        var found = category == null ? products.searchActive(pattern) : products.searchActive(pattern, category);
        return withStockAndPromotions(found);
    }

    public ProductView getProduct(String sku) {
        var product = products.findById(sku.strip().toUpperCase(Locale.ROOT))
                .orElseThrow(() -> NotFoundException.product(sku));
        return withStockAndPromotions(List.of(product)).getFirst();
    }

    private List<ProductView> withStockAndPromotions(List<Product> found) {
        if (found.isEmpty()) {
            return List.of();
        }
        var skus = found.stream().map(Product::getSku).toList();
        var stock = inventory.findBySkus(skus).stream().collect(groupingBy(Inventory::getSku));
        var promos = promotions.findValidOn(skus, LocalDate.now(clock)).stream().collect(groupingBy(Promotion::getSku));
        return found.stream()
                .map(p -> new ProductView(p, stock.getOrDefault(p.getSku(), List.of()),
                        promos.getOrDefault(p.getSku(), List.of())))
                .toList();
    }
}
