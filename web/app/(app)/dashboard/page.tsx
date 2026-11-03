"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, Bot, ClipboardCheck, PackageCheck, Wallet, type LucideIcon } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { api } from "@/lib/api";
import { formatAed, formatAedWhole, formatNumber } from "@/lib/format";
import { queryKeys, useOutletNames } from "@/lib/queries";
import type { DashboardSummary, OrderListParams, SalesOrder } from "@/lib/types";

// Recharts is the heaviest dependency; load it only on this page, client-side.
const RevenueChart = dynamic(() => import("@/components/dashboard/revenue-chart").then((m) => m.RevenueChart), {
  ssr: false,
  loading: () => <Skeleton className="h-56 sm:h-64" />,
});

const PENDING: OrderListParams = { status: "PENDING_APPROVAL", page: 0, size: 50 };

function Kpi({ label, value, hint, icon: Icon }: { label: string; value: string; hint?: string; icon: LucideIcon }) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center justify-between text-muted">
        <p className="text-sm font-medium">{label}</p>
        <Icon aria-hidden className="size-4" />
      </div>
      <p className="mt-2 truncate text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </Card>
  );
}

/** Two-part share of orders: a single proportional bar, direct-labelled, with counts in text. */
function SourceSplit({ bySource }: { bySource: DashboardSummary["ordersBySource"] }) {
  const total = bySource.UI + bySource.AI_AGENT;
  const aiPct = total ? Math.round((bySource.AI_AGENT / total) * 100) : 0;
  const segments = [
    { key: "AI_AGENT", label: "AI agent", count: bySource.AI_AGENT, pct: aiPct, color: "var(--series-1)" },
    { key: "UI", label: "Web UI", count: bySource.UI, pct: 100 - aiPct, color: "var(--series-2)" },
  ];
  if (!total) return <p className="text-sm text-muted">No orders yet.</p>;
  return (
    <div>
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" aria-hidden>
        {segments.map((s) => (
          <div key={s.key} style={{ width: `${s.pct}%`, background: s.color }} className="first:rounded-l-full last:rounded-r-full" />
        ))}
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-3">
        {segments.map((s) => (
          <li key={s.key}>
            <p className="flex items-center gap-2 text-sm text-muted">
              <span aria-hidden className="size-2.5 rounded-sm" style={{ background: s.color }} />
              {s.label}
            </p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums">
              {formatNumber(s.count)} <span className="text-sm font-normal text-muted">· {s.pct}%</span>
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-4 border-t border-border pt-3 text-xs leading-relaxed text-muted">
        Agent orders still need a rep&apos;s confirmation; the agent proposes, people decide.
      </p>
    </div>
  );
}

function TopProducts({ items }: { items: DashboardSummary["topProducts"] }) {
  if (!items.length) return <p className="text-sm text-muted">No sales yet.</p>;
  const max = Math.max(...items.map((p) => p.revenue));
  return (
    <ol className="flex flex-col gap-3">
      {items.map((p) => (
        <li key={p.sku}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-medium">{p.productName}</span>
            <span className="shrink-0 tabular-nums">{formatAed(p.revenue)}</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <div className="h-1.5 flex-1 rounded-full bg-surface-muted" aria-hidden>
              <div className="h-full rounded-full bg-[var(--series-1)]" style={{ width: `${(p.revenue / max) * 100}%` }} />
            </div>
            <span className="w-16 text-right text-xs text-muted tabular-nums">{formatNumber(p.qtyCases)} cs</span>
          </div>
        </li>
      ))}
    </ol>
  );
}

function LowStock({ items }: { items: DashboardSummary["lowStock"] }) {
  if (!items.length) return <EmptyState icon={PackageCheck} title="All warehouses well stocked" />;
  return (
    <ul className="flex flex-col divide-y divide-border">
      {items.slice(0, 6).map((s) => {
        const critical = s.availableCases < 10;
        return (
          <li key={`${s.sku}-${s.warehouse}`} className="flex items-center justify-between gap-3 py-2.5">
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{s.productName}</span>
              <span className="block font-mono text-xs text-muted">
                {s.sku} · {s.warehouse}
              </span>
            </span>
            <Badge tone={critical ? "danger" : "warning"}>
              {formatNumber(s.availableCases)} cs · {critical ? "critical" : "low"}
            </Badge>
          </li>
        );
      })}
    </ul>
  );
}

function DashboardSkeleton() {
  return (
    <div role="status" className="flex flex-col gap-4">
      <span className="sr-only">Loading dashboard…</span>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-80" />
    </div>
  );
}

export default function DashboardPage() {
  const summary = useQuery({ queryKey: queryKeys.dashboard, queryFn: ({ signal }) => api.dashboard.summary(signal) });
  const pending = useQuery({ queryKey: queryKeys.orders(PENDING), queryFn: ({ signal }) => api.orders.list(PENDING, signal) });

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8 lg:py-8">
      <PageHeader title="Dashboard" description="Sales performance, AI adoption and stock risks across the UAE." />

      {summary.isPending ? (
        <DashboardSkeleton />
      ) : summary.isError ? (
        <ErrorState error={summary.error} onRetry={() => void summary.refetch()} title="Couldn't load the dashboard" />
      ) : (
        <div className="flex flex-col gap-4">
          <section aria-label="Key figures" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Orders today" value={formatNumber(summary.data.ordersToday)} icon={PackageCheck} />
            <Kpi label="Revenue MTD" value={formatAedWhole(summary.data.revenueMtd)} hint="Excludes cancelled orders" icon={Wallet} />
            <Kpi label="Pending approvals" value={formatNumber(summary.data.pendingApprovals)} hint="Over credit limit" icon={ClipboardCheck} />
            <Kpi
              label="Placed by AI agent"
              value={`${Math.round(
                (summary.data.ordersBySource.AI_AGENT /
                  Math.max(1, summary.data.ordersBySource.AI_AGENT + summary.data.ordersBySource.UI)) *
                  100,
              )}%`}
              hint="Share of all orders"
              icon={Bot}
            />
          </section>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader title="Revenue by day" description="AED, last two weeks" />
              <CardBody>
                <RevenueChart data={summary.data.revenueByDay} />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Orders by source" description="AI agent vs web UI" />
              <CardBody>
                <SourceSplit bySource={summary.data.ordersBySource} />
              </CardBody>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader title="Top products" description="By revenue" />
              <CardBody>
                <TopProducts items={summary.data.topProducts} />
              </CardBody>
            </Card>
            <Card>
              <CardHeader
                title={
                  <span className="inline-flex items-center gap-1.5">
                    <AlertTriangle aria-hidden className="size-4 text-warning" /> Low stock
                  </span>
                }
                description="Available cases per warehouse"
              />
              <CardBody>
                <LowStock items={summary.data.lowStock} />
              </CardBody>
            </Card>
            <Card>
              <CardHeader
                title="Pending approvals"
                action={
                  <Link href="/approvals" className="inline-flex items-center gap-1 text-sm font-medium text-primary-text hover:underline">
                    Review <ArrowRight aria-hidden className="size-4" />
                  </Link>
                }
              />
              <CardBody>
                {pending.isPending ? (
                  <Skeleton className="h-32" />
                ) : pending.isError ? (
                  <ErrorState error={pending.error} onRetry={() => void pending.refetch()} />
                ) : (
                  <PendingMini orders={pending.data.items.slice(0, 4)} />
                )}
              </CardBody>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

/** Compact pending list for the dashboard card (the full list lives on /approvals). */
function PendingMini({ orders }: { orders: SalesOrder[] }) {
  const outletNames = useOutletNames();
  if (!orders.length) return <p className="text-sm text-muted">Nothing waiting. Nice.</p>;
  return (
    <ul className="flex flex-col divide-y divide-border">
      {orders.map((o) => (
        <li key={o.id}>
          <Link href={`/orders/${o.id}`} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-primary-text">
            <span className="min-w-0">
              <span className="block font-mono font-medium">{o.orderNo}</span>
              <span className="block truncate text-xs text-muted">{o.outletName ?? outletNames.get(o.outletId) ?? `Outlet #${o.outletId}`}</span>
            </span>
            <span className="shrink-0 font-medium tabular-nums">{formatAed(o.total)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
