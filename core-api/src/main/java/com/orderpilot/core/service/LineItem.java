package com.orderpilot.core.service;

/** A requested order line: SKU and quantity in cases. */
public record LineItem(String sku, int qtyCases) {
}
