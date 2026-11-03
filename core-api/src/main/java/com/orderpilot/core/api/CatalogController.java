package com.orderpilot.core.api;

import com.orderpilot.core.api.dto.OutletDto;
import com.orderpilot.core.api.dto.ProductDto;
import com.orderpilot.core.domain.Category;
import com.orderpilot.core.service.CatalogService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Tag(name = "Catalog", description = "Outlets and products (any authenticated user)")
class CatalogController {

    private final CatalogService catalog;

    CatalogController(CatalogService catalog) {
        this.catalog = catalog;
    }

    @GetMapping("/api/outlets")
    @Operation(summary = "Search outlets by name, code or city (case-insensitive contains)")
    List<OutletDto> outlets(@RequestParam(required = false) String q) {
        return catalog.searchOutlets(q).stream().map(OutletDto::from).toList();
    }

    @GetMapping("/api/outlets/{id}")
    OutletDto outlet(@PathVariable long id) {
        return OutletDto.from(catalog.getOutlet(id));
    }

    @GetMapping("/api/products")
    @Operation(summary = "Search active products by name, brand or SKU, optionally by category; includes stock")
    List<ProductDto> products(@RequestParam(required = false) String q,
                              @RequestParam(required = false) Category category) {
        return catalog.searchProducts(q, category).stream().map(ProductDto::from).toList();
    }

    @GetMapping("/api/products/{sku}")
    @Operation(summary = "Product with stock per warehouse and today's promotions")
    ProductDto product(@PathVariable String sku) {
        return ProductDto.from(catalog.getProduct(sku));
    }
}
