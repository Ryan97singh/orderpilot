"use client";

import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { OrderList } from "@/components/orders/order-list";
import { Button } from "@/components/ui/button";
import { Alert, ErrorState, LoadingRows } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/api-error";
import { useOrderAction } from "@/lib/order-mutations";
import { queryKeys } from "@/lib/queries";
import type { OrderListParams } from "@/lib/types";

/** Same params as the nav badge query, so they share one cache entry. */
const PARAMS: OrderListParams = { status: "PENDING_APPROVAL", page: 0, size: 50 };

export default function ApprovalsPage() {
  const query = useQuery({ queryKey: queryKeys.orders(PARAMS), queryFn: ({ signal }) => api.orders.list(PARAMS, signal) });
  const approve = useOrderAction("approve");

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 lg:px-8 lg:py-8">
      <PageHeader
        title="Approvals"
        description="Orders that would take an outlet over its credit limit wait here for a manager."
      />
      {approve.isError && (
        <Alert tone="danger" title="Couldn't approve" className="mb-4">
          {errorMessage(approve.error)}
        </Alert>
      )}
      {query.isPending ? (
        <LoadingRows label="Loading approvals" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <OrderList
          orders={query.data.items}
          emptyTitle="Nothing waiting for approval"
          action={(order) => (
            <Button
              size="sm"
              onClick={() => approve.mutate(order.id)}
              loading={approve.isPending && approve.variables === order.id}
              disabled={approve.isPending}
              aria-label={`Approve ${order.orderNo}`}
            >
              <Check aria-hidden className="size-4" />
              <span className="hidden sm:inline">Approve</span>
            </Button>
          )}
        />
      )}
    </div>
  );
}
