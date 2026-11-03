import { AlertTriangle, BadgePercent, Check, PencilLine, ShieldAlert, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CHANNEL_LABEL, cn, formatAed, formatNumber, promotionLabel } from "@/lib/format";
import type { Quote } from "@/lib/types";

export type QuoteCardState = "actionable" | "confirming" | "confirmed" | "inactive";

interface QuoteCardProps {
  quote: Quote;
  /** False when the agent returned no pending_action (e.g. a line can't be fulfilled). */
  canConfirm: boolean;
  state: QuoteCardState;
  onConfirm: () => void;
  onEdit: () => void;
}

/** The human-in-the-loop confirmation card: nothing is ordered until the rep presses Confirm. */
export function QuoteCard({ quote, canConfirm, state, onConfirm, onEdit }: QuoteCardProps) {
  const { outlet } = quote;
  const needsApproval = quote.creditStatus === "NEEDS_APPROVAL";
  const blocked = quote.lines.some((l) => !l.fulfillable);
  const promotions = quote.lines.flatMap((l) => {
    const label = promotionLabel(l.promotion);
    return label ? [{ sku: l.sku, label }] : [];
  });
  const availableCredit = outlet.availableCredit ?? outlet.creditLimit - outlet.outstandingBalance;

  return (
    <section aria-label={`Quote for ${outlet.name}`} className="overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wide text-muted uppercase">Quote · awaiting your confirmation</p>
          <h3 className="mt-0.5 truncate font-semibold">{outlet.name}</h3>
          <p className="text-xs text-muted">
            {outlet.code} · {CHANNEL_LABEL[outlet.channel] ?? outlet.channel} · {outlet.city}
          </p>
        </div>
        {needsApproval ? (
          <Badge tone="warning">
            <ShieldAlert aria-hidden className="size-3.5" /> Needs manager approval
          </Badge>
        ) : (
          <Badge tone="success">
            <ShieldCheck aria-hidden className="size-3.5" /> Credit OK
          </Badge>
        )}
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Order lines</caption>
          <thead className="text-xs text-muted">
            <tr className="border-b border-border">
              <th scope="col" className="px-4 py-2 text-left font-medium">Product</th>
              <th scope="col" className="px-2 py-2 text-right font-medium">Cases</th>
              <th scope="col" className="hidden px-2 py-2 text-right font-medium sm:table-cell">Unit</th>
              <th scope="col" className="hidden px-2 py-2 text-right font-medium sm:table-cell">Disc.</th>
              <th scope="col" className="px-4 py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {quote.lines.map((line) => (
              <tr key={line.sku} className="border-b border-border last:border-0 align-top">
                <td className="px-4 py-2.5">
                  <p className="font-medium">{line.productName}</p>
                  <p className="font-mono text-xs text-muted">{line.sku}</p>
                  {line.discountPct > 0 && (
                    <p className="text-xs text-success sm:hidden">−{line.discountPct}% promotion</p>
                  )}
                  {line.fulfillable ? (
                    <p className="text-xs text-muted">{formatNumber(line.available)} available</p>
                  ) : (
                    <p className="flex items-center gap-1 text-xs font-medium text-danger">
                      <AlertTriangle aria-hidden className="size-3" /> Only {formatNumber(line.available)} available
                    </p>
                  )}
                </td>
                <td className="px-2 py-2.5 text-right tabular-nums">{formatNumber(line.qtyCases)}</td>
                <td className="hidden px-2 py-2.5 text-right tabular-nums sm:table-cell">{formatAed(line.unitPrice)}</td>
                <td className="hidden px-2 py-2.5 text-right tabular-nums sm:table-cell">
                  {line.discountPct > 0 ? <span className="text-success">−{line.discountPct}%</span> : <span className="text-muted">—</span>}
                </td>
                <td className="px-4 py-2.5 text-right font-medium tabular-nums">{formatAed(line.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 border-t border-border bg-surface-muted/50 px-4 py-3">
        {promotions.length > 0 && (
          <ul aria-label="Promotions applied" className="flex flex-wrap gap-1.5">
            {promotions.map((p) => (
              <li key={p.sku}>
                <Badge tone="success" className="whitespace-normal">
                  <BadgePercent aria-hidden className="size-3.5" /> {p.label}
                </Badge>
              </li>
            ))}
          </ul>
        )}

        {quote.warnings.length > 0 && (
          <ul aria-label="Warnings" className="flex flex-col gap-1 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">
            {quote.warnings.map((w) => (
              <li key={w} className="flex gap-2">
                <AlertTriangle aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                <span className="text-foreground/85">{w}</span>
              </li>
            ))}
          </ul>
        )}

        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted">Subtotal</dt>
          <dd className="text-right tabular-nums">{formatAed(quote.subtotal)}</dd>
          <dt className="text-muted">Promotions</dt>
          <dd className="text-right text-success tabular-nums">−{formatAed(quote.discount)}</dd>
          <dt className="font-semibold">Total</dt>
          <dd className="text-right text-base font-semibold tabular-nums">{formatAed(quote.total)}</dd>
          <dt className="text-xs text-muted">Available credit</dt>
          <dd className={cn("text-right text-xs tabular-nums", needsApproval ? "text-warning" : "text-muted")}>
            {formatAed(availableCredit)}
          </dd>
        </dl>
      </div>

      <footer className="flex flex-col-reverse gap-2 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-end">
        {state === "confirmed" ? (
          <p className="flex items-center gap-1.5 text-sm font-medium text-success sm:mr-auto">
            <Check aria-hidden className="size-4" /> Confirmed
          </p>
        ) : state === "inactive" ? (
          <p className="text-xs text-muted sm:mr-auto">Superseded by a newer message</p>
        ) : (
          <>
            {blocked && <p className="text-xs text-danger sm:mr-auto">Fix the stock issue before confirming.</p>}
            <Button variant="secondary" onClick={onEdit} disabled={state === "confirming"} className="w-full sm:w-auto">
              <PencilLine aria-hidden className="size-4" /> Edit
            </Button>
            <Button onClick={onConfirm} disabled={!canConfirm} loading={state === "confirming"} className="w-full sm:w-auto">
              <Check aria-hidden className="size-4" /> {needsApproval ? "Confirm & send for approval" : "Confirm order"}
            </Button>
          </>
        )}
      </footer>
    </section>
  );
}
