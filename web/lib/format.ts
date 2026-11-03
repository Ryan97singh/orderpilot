import { twMerge } from "tailwind-merge";
import type { Category, Channel, OrderStatus, Promotion } from "@/lib/types";

const aed = new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", minimumFractionDigits: 2 });
const aedWhole = new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 0 });
const aedCompact = new Intl.NumberFormat("en-AE", {
  style: "currency",
  currency: "AED",
  notation: "compact",
  maximumFractionDigits: 1,
});
const number = new Intl.NumberFormat("en-US");
// Fixed time zone so server and client render the same text (no hydration mismatch).
const dateTime = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Dubai",
});
const shortDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

export const formatAed = (value: number) => aed.format(value);
/** For headline figures where fils are noise. */
export const formatAedWhole = (value: number) => aedWhole.format(value);
export const formatAedCompact = (value: number) => aedCompact.format(value);
export const formatNumber = (value: number) => number.format(value);
export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));
/** For `YYYY-MM-DD` dates (no time component). */
export const formatShortDate = (isoDate: string) => shortDate.format(new Date(`${isoDate.slice(0, 10)}T00:00:00Z`));

export const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING_APPROVAL: "Pending approval",
  CONFIRMED: "Confirmed",
  DISPATCHED: "Dispatched",
  CANCELLED: "Cancelled",
};

export const CATEGORY_LABEL: Record<Category, string> = {
  CARBONATED: "Carbonated",
  JUICE: "Juice",
  WATER: "Water",
  ENERGY: "Energy",
};

export const CHANNEL_LABEL: Record<Channel, string> = {
  GROCERY: "Grocery",
  HORECA: "HoReCa",
  MODERN_TRADE: "Modern trade",
};

export function promotionLabel(promotion: Promotion | string | null): string | null {
  if (!promotion) return null;
  return typeof promotion === "string" ? promotion : promotion.description;
}

/** Joins class names, skipping falsy values; later Tailwind classes win over conflicting earlier ones. */
export function cn(...classes: (string | false | null | undefined)[]) {
  return twMerge(classes.filter(Boolean).join(" "));
}
