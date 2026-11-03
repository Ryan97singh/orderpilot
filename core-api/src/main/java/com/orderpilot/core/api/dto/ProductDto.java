package com.orderpilot.core.api.dto;

import com.orderpilot.core.domain.Category;
import com.orderpilot.core.domain.Inventory;
import com.orderpilot.core.domain.Warehouse;
import com.orderpilot.core.service.ProductView;
import java.math.BigDecimal;
import java.util.List;

public record ProductDto(
        String sku,
        String name,
        String brand,
        Category category,
        String packSize,
        BigDecimal casePrice,
        boolean active,
        int totalAvailableCases,
        List<StockDto> stock,
        List<PromotionDto> promotions) {

    public record StockDto(Warehouse warehouse, int onHandCases, int reservedCases, int availableCases) {

        static StockDto from(Inventory inventory) {
            return new StockDto(inventory.getWarehouse(), inventory.getOnHandCases(), inventory.getReservedCases(),
                    inventory.availableCases());
        }
    }

    public static ProductDto from(ProductView view) {
        var product = view.product();
        var stock = view.stock().stream().map(StockDto::from).toList();
        return new ProductDto(product.getSku(), product.getName(), product.getBrand(), product.getCategory(),
                product.getPackSize(), product.getCasePrice(), product.isActive(),
                stock.stream().mapToInt(StockDto::availableCases).sum(), stock,
                view.promotions().stream().map(PromotionDto::from).toList());
    }
}
