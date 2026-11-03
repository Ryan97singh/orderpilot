package com.orderpilot.core.repository;

import com.orderpilot.core.domain.Inventory;
import com.orderpilot.core.domain.Warehouse;
import java.util.Collection;
import java.util.List;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface InventoryRepository extends JpaRepository<Inventory, Long> {

    @Query("select i from Inventory i where i.product.sku in :skus and i.warehouse = :warehouse")
    List<Inventory> findBySkusInWarehouse(@Param("skus") Collection<String> skus,
                                          @Param("warehouse") Warehouse warehouse);

    @Query("select i from Inventory i where i.product.sku in :skus order by i.product.sku, i.warehouse")
    List<Inventory> findBySkus(@Param("skus") Collection<String> skus);

    @EntityGraph(attributePaths = "product")
    @Query("""
            select i from Inventory i
            where i.product.active = true and (i.onHandCases - i.reservedCases) < :threshold
            order by (i.onHandCases - i.reservedCases), i.product.sku
            """)
    List<Inventory> findLowStock(@Param("threshold") int threshold, Limit limit);
}
