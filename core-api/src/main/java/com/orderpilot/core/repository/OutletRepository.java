package com.orderpilot.core.repository;

import com.orderpilot.core.domain.Outlet;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OutletRepository extends JpaRepository<Outlet, Long> {

    /** @param pattern a lower-case LIKE pattern from {@link SearchPattern#contains(String)} */
    @Query("""
            select o from Outlet o
            where lower(o.name) like :pattern escape '\\'
               or lower(o.code) like :pattern escape '\\'
               or lower(o.city) like :pattern escape '\\'
            order by o.name
            """)
    List<Outlet> search(@Param("pattern") String pattern);
}
