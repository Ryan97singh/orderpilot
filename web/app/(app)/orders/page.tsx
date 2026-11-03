"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, MessageSquarePlus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { OrderList } from "@/components/orders/order-list";
import { Button, buttonClasses } from "@/components/ui/button";
import { ErrorState, LoadingRows } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { api } from "@/lib/api";
import { STATUS_LABEL, cn } from "@/lib/format";
import { queryKeys } from "@/lib/queries";
import type { OrderListParams, OrderStatus } from "@/lib/types";

const PAGE_SIZE = 10;
const FILTERS: (OrderStatus | "ALL")[] = ["ALL", "PENDING_APPROVAL", "CONFIRMED", "DISPATCHED", "CANCELLED"];

export default function OrdersPage() {
  const [status, setStatus] = useState<OrderStatus | "ALL">("ALL");
  const [page, setPage] = useState(0);
  const params: OrderListParams = { status: status === "ALL" ? undefined : status, page, size: PAGE_SIZE };

  const query = useQuery({
    queryKey: queryKeys.orders(params),
    queryFn: ({ signal }) => api.orders.list(params, signal),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 lg:px-8 lg:py-8">
      <PageHeader
        title="Orders"
        description="Newest first. Orders placed by the AI agent are tagged."
        actions={
          <Link href="/chat" className={buttonClasses({ variant: "secondary" })}>
            <MessageSquarePlus aria-hidden className="size-4" /> New order via chat
          </Link>
        }
      />

      <div role="group" aria-label="Filter by status" className="-mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={status === f}
            onClick={() => {
              setStatus(f);
              setPage(0);
            }}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
              status === f
                ? "border-primary bg-primary-soft text-primary-text"
                : "border-border bg-surface text-muted hover:text-foreground",
            )}
          >
            {f === "ALL" ? "All" : STATUS_LABEL[f]}
          </button>
        ))}
      </div>

      {query.isPending ? (
        <LoadingRows rows={6} label="Loading orders" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <div className={cn("transition-opacity", query.isPlaceholderData && "opacity-60")}>
          <OrderList orders={query.data.items} emptyTitle="No orders with this status" />
          {query.data.totalPages > 1 && (
            <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm text-muted">
              <span>
                Page {query.data.page + 1} of {query.data.totalPages} · {query.data.totalItems} orders
              </span>
              <span className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => setPage((p) => p - 1)} disabled={page === 0}>
                  <ChevronLeft aria-hidden className="size-4" /> Previous
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page + 1 >= query.data.totalPages}
                >
                  Next <ChevronRight aria-hidden className="size-4" />
                </Button>
              </span>
            </nav>
          )}
        </div>
      )}
    </div>
  );
}
