package com.orderpilot.core.repository;

import com.orderpilot.core.domain.Category;
import com.orderpilot.core.domain.Product;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProductRepository extends JpaRepository<Product, String> {

    String MATCHES = """
            (lower(p.name) like :pattern escape '\\'
             or lower(p.brand) like :pattern escape '\\'
             or lower(p.sku) like :pattern escape '\\')""";

    /** @param pattern a lower-case LIKE pattern from {@link SearchPattern#contains(String)} */
    @Query("select p from Product p where p.active = true and " + MATCHES + " order by p.brand, p.name")
    List<Product> searchActive(@Param("pattern") String pattern);

    @Query("select p from Product p where p.active = true and p.category = :category and " + MATCHES
            + " order by p.brand, p.name")
    List<Product> searchActive(@Param("pattern") String pattern, @Param("category") Category category);
}
