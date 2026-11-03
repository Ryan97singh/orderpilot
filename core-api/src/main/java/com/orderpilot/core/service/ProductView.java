package com.orderpilot.core.service;

import com.orderpilot.core.domain.Inventory;
import com.orderpilot.core.domain.Product;
import com.orderpilot.core.domain.Promotion;
import java.util.List;

/** A product with its stock per warehouse and the promotions valid today. */
public record ProductView(Product product, List<Inventory> stock, List<Promotion> promotions) {
}
