package com.orderpilot.core.api.dto;

import com.orderpilot.core.domain.Channel;
import com.orderpilot.core.domain.Outlet;
import com.orderpilot.core.domain.Warehouse;
import java.math.BigDecimal;

public record OutletDto(
        long id,
        String code,
        String name,
        Channel channel,
        String city,
        Warehouse warehouse,
        BigDecimal creditLimit,
        BigDecimal outstandingBalance,
        BigDecimal availableCredit,
        String salesRepId) {

    public static OutletDto from(Outlet outlet) {
        return new OutletDto(outlet.getId(), outlet.getCode(), outlet.getName(), outlet.getChannel(), outlet.getCity(),
                outlet.warehouse(), outlet.getCreditLimit(), outlet.getOutstandingBalance(), outlet.availableCredit(),
                outlet.getSalesRepId());
    }
}
