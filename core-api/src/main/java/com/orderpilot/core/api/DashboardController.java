package com.orderpilot.core.api;

import com.orderpilot.core.service.DashboardService;
import com.orderpilot.core.service.DashboardSummary;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Tag(name = "Dashboard")
class DashboardController {

    private final DashboardService dashboard;

    DashboardController(DashboardService dashboard) {
        this.dashboard = dashboard;
    }

    @GetMapping("/api/dashboard/summary")
    @PreAuthorize("hasRole('MANAGER')")
    DashboardSummary summary() {
        return dashboard.summary();
    }
}
