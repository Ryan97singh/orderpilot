"use client";

import { ChevronRight, PackageOpen } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { OrderStatusBadge, SourceBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { formatAed, formatDateTime } from "@/lib/format";
import { useOutletNames } from "@/lib/queries";
import type { SalesOrder } from "@/lib/types";

/** Responsive order list: stacked cards on phones, aligned columns from `sm` up. */
export function OrderList({
  orders,
  emptyTitle = "No orders found",
  action,
}: {
  orders: SalesOrder[];
  emptyTitle?: string;
  /** Optional per-row action (e.g. Approve), rendered beside the row link. */
  action?: (order: SalesOrder) => ReactNode;
}) {
  const outletNames = useOutletNames();

  if (!orders.length) return <EmptyState icon={PackageOpen} title={emptyTitle} />;

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
      {orders.map((order) => {
        const outlet = order.outletName ?? outletNames.get(order.outletId) ?? `Outlet #${order.outletId}`;
        return (
          <li key={order.id} className="flex items-center gap-2 pr-2 transition-colors hover:bg-surface-muted/60">
            <Link
              href={`/orders/${order.id}`}
              className="grid min-w-0 flex-1 grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-3 sm:grid-cols-[9rem_1fr_9rem_7.5rem_6.5rem]"
            >
              <span className="font-mono text-sm font-medium">{order.orderNo}</span>
              <span className="text-right font-medium tabular-nums sm:order-4">{formatAed(order.total)}</span>
              <span className="min-w-0 truncate text-sm sm:order-2">
                {outlet}
                <span className="block text-xs text-muted">{formatDateTime(order.createdAt)}</span>
              </span>
              <span className="flex justify-end gap-1.5 sm:order-3 sm:justify-start">
                <OrderStatusBadge status={order.status} />
              </span>
              <span className="hidden sm:order-5 sm:flex sm:items-center sm:justify-end sm:gap-2">
                <SourceBadge source={order.source} />
                <ChevronRight aria-hidden className="size-4 text-muted" />
              </span>
            </Link>
            {action?.(order)}
          </li>
        );
      })}
    </ul>
  );
}
