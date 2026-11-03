/**
 * Shared TanStack Query keys and hooks used by more than one screen.
 * Screen-specific queries live next to the screen.
 */
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth/auth-context";
import type { OrderListParams } from "@/lib/types";

export const queryKeys = {
  outlets: ["outlets"] as const,
  outlet: (id: number) => ["outlets", id] as const,
  products: (q: string, category: string) => ["products", { q, category }] as const,
  product: (sku: string) => ["products", sku] as const,
  orders: (params: OrderListParams) => ["orders", params] as const,
  order: (id: number) => ["orders", "detail", id] as const,
  dashboard: ["dashboard"] as const,
  knowledge: (q: string) => ["knowledge", q] as const,
};

/** Outlet id → name, for list views (the spec's order list doesn't include the outlet name). */
export function useOutletNames() {
  const { data } = useQuery({
    queryKey: queryKeys.outlets,
    queryFn: ({ signal }) => api.outlets.search(undefined, signal),
    staleTime: 5 * 60_000,
  });
  return useMemo(() => new Map((data ?? []).map((o) => [o.id, o.name])), [data]);
}

/** Pending approval count for the manager nav badge. */
export function usePendingApprovalCount() {
  const { isManager } = useAuth();
  const params: OrderListParams = { status: "PENDING_APPROVAL", page: 0, size: 50 };
  const { data } = useQuery({
    queryKey: queryKeys.orders(params),
    queryFn: ({ signal }) => api.orders.list(params, signal),
    enabled: isManager,
  });
  return data?.totalItems ?? 0;
}
