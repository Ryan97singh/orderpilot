package com.orderpilot.core.repository;

import com.orderpilot.core.domain.Promotion;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PromotionRepository extends JpaRepository<Promotion, Long> {

    @Query("""
            select p from Promotion p
            where p.sku in :skus and p.validFrom <= :day and p.validTo >= :day
            order by p.sku, p.discountPct desc
            """)
    List<Promotion> findValidOn(@Param("skus") Collection<String> skus, @Param("day") LocalDate day);
}
