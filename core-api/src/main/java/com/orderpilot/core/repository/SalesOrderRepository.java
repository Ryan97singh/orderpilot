package com.orderpilot.core.repository;

import com.orderpilot.core.domain.OrderSource;
import com.orderpilot.core.domain.OrderStatus;
import com.orderpilot.core.domain.SalesOrder;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Limit;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SalesOrderRepository extends JpaRepository<SalesOrder, Long>, JpaSpecificationExecutor<SalesOrder> {

    @EntityGraph(attributePaths = {"outlet", "lines"})
    Optional<SalesOrder> findWithLinesById(Long id);

    @EntityGraph(attributePaths = {"outlet", "lines"})
    Optional<SalesOrder> findByIdempotencyKey(String idempotencyKey);

    @Override
    @EntityGraph(attributePaths = "outlet")
    Page<SalesOrder> findAll(Specification<SalesOrder> spec, Pageable pageable);

    long countByStatus(OrderStatus status);

    long countByCreatedAtGreaterThanEqualAndStatusNot(Instant from, OrderStatus excluded);

    @Query("""
            select coalesce(sum(o.total), 0) from SalesOrder o
            where o.status in :statuses and o.createdAt >= :from
            """)
    BigDecimal sumTotal(@Param("statuses") Collection<OrderStatus> statuses, @Param("from") Instant from);

    @Query("""
            select new com.orderpilot.core.repository.SalesOrderRepository$SourceCount(o.source, count(o))
            from SalesOrder o
            where o.status <> com.orderpilot.core.domain.OrderStatus.CANCELLED and o.createdAt >= :from
            group by o.source
            """)
    List<SourceCount> countBySource(@Param("from") Instant from);

    @Query("""
            select new com.orderpilot.core.repository.SalesOrderRepository$DatedAmount(o.createdAt, o.total)
            from SalesOrder o
            where o.status in :statuses and o.createdAt >= :from
            """)
    List<DatedAmount> amountsSince(@Param("statuses") Collection<OrderStatus> statuses, @Param("from") Instant from);

    @Query("""
            select new com.orderpilot.core.repository.SalesOrderRepository$ProductSales(
                       l.sku, l.productName, sum(l.qtyCases), sum(l.lineTotal))
            from OrderLine l join l.order o
            where o.status in :statuses and o.createdAt >= :from
            group by l.sku, l.productName
            order by sum(l.lineTotal) desc
            """)
    List<ProductSales> topProducts(@Param("statuses") Collection<OrderStatus> statuses, @Param("from") Instant from,
                                   Limit limit);

    record SourceCount(OrderSource source, Long orders) {
    }

    record DatedAmount(Instant createdAt, BigDecimal total) {
    }

    record ProductSales(String sku, String productName, Long qtyCases, BigDecimal revenue) {
    }
}
