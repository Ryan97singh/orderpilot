import type { ReactNode } from "react";
import { cn, STATUS_LABEL } from "@/lib/format";
import type { OrderSource, OrderStatus } from "@/lib/types";

export type Tone = "neutral" | "primary" | "success" | "warning" | "danger";

const TONES: Record<Tone, string> = {
  neutral: "bg-surface-muted text-muted border-border",
  primary: "bg-primary-soft text-primary-text border-transparent",
  success: "bg-success-soft text-success border-transparent",
  warning: "bg-warning-soft text-warning border-transparent",
  danger: "bg-danger-soft text-danger border-transparent",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const STATUS_TONE: Record<OrderStatus, Tone> = {
  PENDING_APPROVAL: "warning",
  CONFIRMED: "success",
  DISPATCHED: "primary",
  CANCELLED: "neutral",
};

/** Status is conveyed by text, not colour alone. */
export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}

export function SourceBadge({ source }: { source: OrderSource }) {
  return source === "AI_AGENT" ? <Badge tone="primary">AI agent</Badge> : <Badge>Web UI</Badge>;
}
