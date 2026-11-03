import { ArrowRight, CheckCircle2, Clock } from "lucide-react";
import Link from "next/link";
import { OrderStatusBadge } from "@/components/ui/badge";
import { formatAed } from "@/lib/format";
import type { SalesOrder } from "@/lib/types";

export function OrderPlacedCard({ order }: { order: SalesOrder }) {
  const pending = order.status === "PENDING_APPROVAL";
  const Icon = pending ? Clock : CheckCircle2;
  return (
    <section
      aria-label={`Order ${order.orderNo}`}
      className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-xs sm:flex-row sm:items-center"
    >
      <span
        className={`inline-flex size-10 shrink-0 items-center justify-center rounded-full ${pending ? "bg-warning-soft text-warning" : "bg-success-soft text-success"}`}
      >
        <Icon aria-hidden className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 font-semibold">
          {order.orderNo} <OrderStatusBadge status={order.status} />
        </p>
        <p className="mt-0.5 text-sm text-muted">
          {order.outletName ? `${order.outletName} · ` : ""}
          {formatAed(order.total)}
          {pending ? " · a manager will review it" : " · stock reserved"}
        </p>
      </div>
      <Link
        href={`/orders/${order.id}`}
        className="inline-flex items-center gap-1 self-start rounded-lg px-2 py-1 text-sm font-medium text-primary-text hover:bg-primary-soft sm:self-center"
      >
        View order <ArrowRight aria-hidden className="size-4" />
      </Link>
    </section>
  );
}
