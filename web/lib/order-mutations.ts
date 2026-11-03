"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queries";

type Action = "approve" | "cancel" | "aiSummary";

/** Approve / cancel / AI summary for an order, keeping detail, lists and dashboard in sync. */
export function useOrderAction(action: Action) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.orders[action](id),
    onSuccess: async (_order, id) => {
      const refreshes = [queryClient.invalidateQueries({ queryKey: queryKeys.order(id) })];
      if (action !== "aiSummary") {
        // Status changes move stock and money: refresh everything that shows them.
        refreshes.push(
          queryClient.invalidateQueries({ queryKey: ["orders"] }),
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
          queryClient.invalidateQueries({ queryKey: ["products"] }),
        );
      }
      await Promise.all(refreshes);
    },
  });
}
