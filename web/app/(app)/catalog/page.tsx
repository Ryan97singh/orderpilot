"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronDown, PackageSearch, Search } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ErrorState, LoadingRows, Skeleton, EmptyState } from "@/components/ui/feedback";
import { Field, Input, Select } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { api } from "@/lib/api";
import { CATEGORY_LABEL, cn, formatAed, formatNumber } from "@/lib/format";
import { queryKeys } from "@/lib/queries";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import type { Category, Product } from "@/lib/types";

const CATEGORIES = Object.keys(CATEGORY_LABEL) as Category[];
const LOW_STOCK = 25;
const WAREHOUSE_NAME: Record<string, string> = { DXB: "Dubai", AUH: "Abu Dhabi", SHJ: "Sharjah" };

/** Stock per warehouse, loaded on demand from GET /api/products/{sku}. */
function StockPanel({ sku }: { sku: string }) {
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: queryKeys.product(sku),
    queryFn: ({ signal }) => api.products.get(sku, signal),
  });
  if (isPending) return <Skeleton className="h-16" />;
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} title="Couldn't load stock" />;
  if (!data.stock?.length) return <p className="text-sm text-muted">No stock information.</p>;

  return (
    <table className="w-full text-sm">
      <caption className="sr-only">Stock by warehouse for {data.name}</caption>
      <thead className="text-xs text-muted">
        <tr>
          <th scope="col" className="py-1 text-left font-medium">Warehouse</th>
          <th scope="col" className="py-1 text-right font-medium">On hand</th>
          <th scope="col" className="py-1 text-right font-medium">Reserved</th>
          <th scope="col" className="py-1 text-right font-medium">Available</th>
        </tr>
      </thead>
      <tbody>
        {data.stock.map((s) => (
          <tr key={s.warehouse} className="border-t border-border">
            <td className="py-1.5">
              <span className="font-mono text-xs font-medium">{s.warehouse}</span>{" "}
              <span className="text-muted">{WAREHOUSE_NAME[s.warehouse]}</span>
            </td>
            <td className="py-1.5 text-right tabular-nums">{formatNumber(s.onHandCases)}</td>
            <td className="py-1.5 text-right text-muted tabular-nums">{formatNumber(s.reservedCases)}</td>
            <td className="py-1.5 text-right font-medium tabular-nums">
              {s.availableCases < LOW_STOCK ? (
                <span className="text-warning">{formatNumber(s.availableCases)} · low</span>
              ) : (
                formatNumber(s.availableCases)
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ProductCard({ product }: { product: Product }) {
  const [open, setOpen] = useState(false);
  const panelId = `stock-${product.sku}`;
  return (
    <li className="flex flex-col rounded-xl border border-border bg-surface">
      <div className="flex flex-1 flex-col gap-1 p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium text-muted">{product.brand}</p>
          {product.active ? <Badge>{CATEGORY_LABEL[product.category]}</Badge> : <Badge tone="danger">Discontinued</Badge>}
        </div>
        <h2 className="font-semibold">{product.name}</h2>
        <p className="text-sm text-muted">{product.packSize}</p>
        <div className="mt-2 flex items-end justify-between">
          <p>
            <span className="text-lg font-semibold tabular-nums">{formatAed(product.casePrice)}</span>
            <span className="text-xs text-muted"> / case</span>
          </p>
          <p className="font-mono text-xs text-muted">{product.sku}</p>
        </div>
      </div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between border-t border-border px-4 py-2.5 text-sm font-medium text-primary-text hover:bg-surface-muted"
      >
        Stock by warehouse
        <ChevronDown aria-hidden className={cn("size-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div id={panelId} className="border-t border-border px-4 py-3">
          <StockPanel sku={product.sku} />
        </div>
      )}
    </li>
  );
}

export default function CatalogPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category | "">("");
  const q = useDebouncedValue(search.trim());

  const query = useQuery({
    queryKey: queryKeys.products(q, category),
    queryFn: ({ signal }) => api.products.search({ q, category }, signal),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8 lg:py-8">
      <PageHeader title="Catalog" description="Prices are per case in AED. The catalog stays available offline once loaded." />

      <form role="search" onSubmit={(e) => e.preventDefault()} className="mb-5 grid gap-3 sm:grid-cols-[1fr_14rem]">
        <Field label="Search products" hideLabel>
          {({ id }) => (
            <div className="relative">
              <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
              <Input
                id={id}
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, brand or SKU"
                className="pl-9"
              />
            </div>
          )}
        </Field>
        <Field label="Category" hideLabel>
          {({ id }) => (
            <Select id={id} value={category} onChange={(e) => setCategory(e.target.value as Category | "")}>
              <option value="">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </form>

      {query.isPending ? (
        <LoadingRows rows={6} label="Loading products" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.length === 0 ? (
        <EmptyState icon={PackageSearch} title="No products match">
          Try a different search or category.
        </EmptyState>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted" aria-live="polite">
            {query.data.length} product{query.data.length === 1 ? "" : "s"}
          </p>
          <ul className={cn("grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3", query.isPlaceholderData && "opacity-60")}>
            {query.data.map((p) => (
              <ProductCard key={p.sku} product={p} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
