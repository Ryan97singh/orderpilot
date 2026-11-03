/**
 * DEV-ONLY mock backend (NEXT_PUBLIC_USE_MOCKS=true).
 *
 * Serves realistic fixture data in the exact shapes from docs/SPEC.md and applies the same
 * business rules (promotions, warehouse stock, credit approval, idempotency) so every page and
 * flow can be exercised without core-api or ai-service running. It returns real `Response`
 * objects, so lib/api.ts header, error and timing handling is exercised too.
 *
 * Loaded through a dynamic import that only runs in mock mode.
 */
import { config } from "@/lib/config";
import type {
  AgentStep,
  Category,
  Channel,
  ChatRequest,
  ChatResponse,
  Citation,
  ConfirmRequest,
  KnowledgeHit,
  OrderLineInput,
  OrderStatus,
  Outlet,
  Product,
  PromptLayer,
  PromptStudioResponse,
  Promotion,
  Quote,
  QuoteLine,
  Role,
  SalesOrder,
  Warehouse,
} from "@/lib/types";

// ── Fixtures ────────────────────────────────────────────────────────────────

const DAY = 86_400_000;
const isoDay = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);
const round2 = (n: number) => Math.round(n * 100) / 100;

const outlets: Outlet[] = [
  ["OUT-1001", "Al Noor Grocery", "GROCERY", "Dubai", 50_000, 18_500],
  ["OUT-1002", "Marina Bay Café", "HORECA", "Dubai", 30_000, 29_200],
  ["OUT-1003", "Palm Fresh Supermarket", "MODERN_TRADE", "Dubai", 150_000, 62_000],
  ["OUT-1004", "Deira Corner Store", "GROCERY", "Dubai", 25_000, 9_800],
  ["OUT-1005", "Corniche Bistro", "HORECA", "Abu Dhabi", 40_000, 12_000],
  ["OUT-1006", "Capital Hypermarket", "MODERN_TRADE", "Abu Dhabi", 200_000, 121_000],
  ["OUT-1007", "Al Wahda Mini Mart", "GROCERY", "Abu Dhabi", 20_000, 4_200],
  ["OUT-1008", "Saadiyat Beach Club", "HORECA", "Abu Dhabi", 60_000, 55_300],
  ["OUT-1009", "Sharjah Family Market", "MODERN_TRADE", "Sharjah", 120_000, 38_000],
  ["OUT-1010", "Al Qasba Grocery", "GROCERY", "Sharjah", 22_000, 21_000],
  ["OUT-1011", "Rolla Street Cafeteria", "HORECA", "Sharjah", 15_000, 3_500],
  ["OUT-1012", "Mirdif Express Grocery", "GROCERY", "Dubai", 28_000, 7_400],
].map(([code, name, channel, city, creditLimit, outstandingBalance], i) => ({
  id: i + 1,
  code: code as string,
  name: name as string,
  channel: channel as Channel,
  city: city as string,
  creditLimit: creditLimit as number,
  outstandingBalance: outstandingBalance as number,
  salesRepId: i % 2 === 0 ? "rep-001" : "rep-002",
}));

const products: Product[] = (
  [
    ["FZ-COLA-330-24", "FizzUp Cola 330ml", "FizzUp", "CARBONATED", "24 x 330ml can", 42],
    ["FZ-ZERO-330-24", "FizzUp Cola Zero 330ml", "FizzUp", "CARBONATED", "24 x 330ml can", 42],
    ["FZ-LEMON-330-24", "FizzUp Lemon-Lime 330ml", "FizzUp", "CARBONATED", "24 x 330ml can", 40],
    ["FZ-ORANGE-330-24", "FizzUp Orange 330ml", "FizzUp", "CARBONATED", "24 x 330ml can", 40],
    ["FZ-COLA-1500-6", "FizzUp Cola 1.5L", "FizzUp", "CARBONATED", "6 x 1.5L PET", 27],
    ["OJ-ORANGE-1000-12", "Oasis Orange Juice 1L", "Oasis Juice", "JUICE", "12 x 1L carton", 66],
    ["OJ-MANGO-250-24", "Oasis Mango Nectar 250ml", "Oasis Juice", "JUICE", "24 x 250ml bottle", 48],
    ["OJ-APPLE-1000-12", "Oasis Apple Juice 1L", "Oasis Juice", "JUICE", "12 x 1L carton", 64],
    ["OJ-MIXED-200-27", "Oasis Mixed Fruit 200ml", "Oasis Juice", "JUICE", "27 x 200ml tetra", 39],
    ["PP-STILL-500-24", "Pure Peak Water 500ml", "Pure Peak Water", "WATER", "24 x 500ml PET", 18],
    ["PP-STILL-1500-12", "Pure Peak Water 1.5L", "Pure Peak Water", "WATER", "12 x 1.5L PET", 16.5],
    ["PP-SPARK-330-24", "Pure Peak Sparkling 330ml", "Pure Peak Water", "WATER", "24 x 330ml glass", 36],
    ["VX-ORIG-250-24", "VoltX Original 250ml", "VoltX Energy", "ENERGY", "24 x 250ml can", 96],
    ["VX-SF-250-24", "VoltX Sugar Free 250ml", "VoltX Energy", "ENERGY", "24 x 250ml can", 96],
    ["VX-TROP-500-12", "VoltX Tropical 500ml", "VoltX Energy", "ENERGY", "12 x 500ml can", 78],
  ] as const
).map(([sku, name, brand, category, packSize, casePrice]) => ({
  sku,
  name,
  brand,
  category: category as Category,
  packSize,
  casePrice,
  active: sku !== "VX-TROP-500-12", // discontinued line, to demo the 422 rule
}));

const WAREHOUSES: Warehouse[] = ["DXB", "AUH", "SHJ"];
const CITY_WAREHOUSE: Record<string, Warehouse> = { Dubai: "DXB", "Abu Dhabi": "AUH", Sharjah: "SHJ" };

/** inventory[sku][warehouse] = { onHand, reserved } */
const inventory: Record<string, Record<Warehouse, { onHand: number; reserved: number }>> = Object.fromEntries(
  products.map((p, i) => [
    p.sku,
    Object.fromEntries(
      WAREHOUSES.map((w, j) => {
        const onHand = 40 + ((i * 37 + j * 53) % 260);
        return [w, { onHand, reserved: (i * 7 + j * 11) % 30 }];
      }),
    ) as Record<Warehouse, { onHand: number; reserved: number }>,
  ]),
);
// A few deliberately low lines so the dashboard and stock warnings have something to show.
inventory["OJ-MANGO-250-24"].SHJ = { onHand: 14, reserved: 8 };
inventory["VX-ORIG-250-24"].AUH = { onHand: 22, reserved: 10 };
inventory["PP-SPARK-330-24"].DXB = { onHand: 18, reserved: 9 };
inventory["FZ-COLA-330-24"].DXB = { onHand: 340, reserved: 40 };

const promotions: Promotion[] = [
  { id: 1, sku: "FZ-COLA-330-24", channel: "GROCERY", discountPct: 8, minCases: 20, validFrom: isoDay(-10), validTo: isoDay(20), description: "FizzUp Cola grocery push: 8% off 20+ cases" },
  { id: 2, sku: "FZ-COLA-330-24", channel: null, discountPct: 5, minCases: 10, validFrom: isoDay(-30), validTo: isoDay(30), description: "FizzUp Cola volume deal: 5% off 10+ cases" },
  { id: 3, sku: "OJ-ORANGE-1000-12", channel: null, discountPct: 10, minCases: 15, validFrom: isoDay(-3), validTo: isoDay(4), description: "Oasis Orange weekly special: 10% off 15+ cases" },
  { id: 4, sku: "OJ-MANGO-250-24", channel: "HORECA", discountPct: 12, minCases: 10, validFrom: isoDay(-5), validTo: isoDay(9), description: "Oasis Mango for cafés: 12% off 10+ cases" },
  { id: 5, sku: "PP-STILL-500-24", channel: "MODERN_TRADE", discountPct: 7, minCases: 50, validFrom: isoDay(-14), validTo: isoDay(16), description: "Pure Peak summer stack: 7% off 50+ cases" },
  { id: 6, sku: "VX-ORIG-250-24", channel: null, discountPct: 6, minCases: 20, validFrom: isoDay(-7), validTo: isoDay(21), description: "VoltX launch support: 6% off 20+ cases" },
];

// ── Pricing (same rules as core-api) ────────────────────────────────────────

class Problem extends Error {
  constructor(
    readonly status: number,
    readonly title: string,
    readonly detail: string,
  ) {
    super(detail);
  }
}

function bestPromotion(sku: string, channel: Channel, qty: number): Promotion | null {
  const today = isoDay(0);
  return (
    promotions
      .filter(
        (p) =>
          p.sku === sku &&
          (p.channel === null || p.channel === channel) &&
          qty >= p.minCases &&
          p.validFrom <= today &&
          today <= p.validTo,
      )
      .sort((a, b) => b.discountPct - a.discountPct)[0] ?? null
  );
}

function available(sku: string, warehouse: Warehouse) {
  const s = inventory[sku][warehouse];
  return s.onHand - s.reserved;
}

function priceQuote(outletId: number, lines: OrderLineInput[]): Quote {
  const outlet = outlets.find((o) => o.id === outletId);
  if (!outlet) throw new Problem(404, "Outlet not found", `Outlet ${outletId} does not exist.`);
  if (!lines?.length) throw new Problem(400, "Invalid order", "An order needs at least one line.");
  const warehouse = CITY_WAREHOUSE[outlet.city];
  const warnings: string[] = [];

  const quoted: QuoteLine[] = lines.map(({ sku, qtyCases }) => {
    const product = products.find((p) => p.sku === sku);
    if (!product || !product.active) {
      throw new Problem(422, "Unknown product", `SKU ${sku} is unknown or no longer active.`);
    }
    if (!(qtyCases > 0)) throw new Problem(400, "Invalid quantity", `Quantity for ${sku} must be at least 1 case.`);
    const promotion = bestPromotion(sku, outlet.channel, qtyCases);
    const discountPct = promotion?.discountPct ?? 0;
    const avail = available(sku, warehouse);
    const fulfillable = avail >= qtyCases;
    if (!fulfillable) {
      warnings.push(`Only ${avail} cases of ${product.name} available in ${warehouse}; ${qtyCases} requested.`);
    }
    return {
      sku,
      productName: product.name,
      qtyCases,
      unitPrice: product.casePrice,
      discountPct,
      promotion,
      lineTotal: round2(qtyCases * product.casePrice * (1 - discountPct / 100)),
      available: avail,
      fulfillable,
    };
  });

  const subtotal = round2(quoted.reduce((sum, l) => sum + l.qtyCases * l.unitPrice, 0));
  const total = round2(quoted.reduce((sum, l) => sum + l.lineTotal, 0));
  const creditStatus = outlet.outstandingBalance + total > outlet.creditLimit ? "NEEDS_APPROVAL" : "OK";
  if (creditStatus === "NEEDS_APPROVAL") {
    warnings.push(
      `This order takes ${outlet.name} over its AED ${outlet.creditLimit.toLocaleString("en-US")} credit limit, so it will need manager approval.`,
    );
  }
  return {
    outlet: { ...outlet, availableCredit: outlet.creditLimit - outlet.outstandingBalance },
    lines: quoted,
    subtotal,
    discount: round2(subtotal - total),
    total,
    creditStatus,
    warnings,
  };
}

// ── Orders (seeded history + anything placed in this browser session) ───────

const ORDERS_KEY = "orderpilot.mock.orders";
const idempotency = new Map<string, number>();

function seedOrders(): SalesOrder[] {
  // Small deterministic PRNG so the seed looks varied but is stable across reloads.
  let seed = 7;
  const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const statuses: OrderStatus[] = ["CONFIRMED", "DISPATCHED", "DISPATCHED", "CONFIRMED", "PENDING_APPROVAL", "CANCELLED"];
  const sellable = products.filter((p) => p.active);
  const orders: SalesOrder[] = [];

  for (let i = 0; i < 25; i++) {
    const outlet = outlets[Math.floor(rand() * outlets.length)];
    const lineCount = 1 + Math.floor(rand() * 3);
    const picked = [...sellable].sort(() => rand() - 0.5).slice(0, lineCount);
    const lines = picked.map((p) => {
      const qtyCases = 5 + Math.floor(rand() * 40);
      const promo = bestPromotion(p.sku, outlet.channel, qtyCases);
      const discountPct = promo?.discountPct ?? 0;
      return {
        sku: p.sku,
        productName: p.name,
        qtyCases,
        unitPrice: p.casePrice,
        discountPct,
        lineTotal: round2(qtyCases * p.casePrice * (1 - discountPct / 100)),
      };
    });
    const subtotal = round2(lines.reduce((s, l) => s + l.qtyCases * l.unitPrice, 0));
    const total = round2(lines.reduce((s, l) => s + l.lineTotal, 0));
    const daysAgo = Math.floor((24 - i) * 0.8);
    const status = i >= 22 ? "PENDING_APPROVAL" : statuses[Math.floor(rand() * statuses.length)];
    orders.push({
      id: i + 1,
      orderNo: `SO-2026-${String(i + 1).padStart(5, "0")}`,
      outletId: outlet.id,
      outletName: outlet.name,
      status: daysAgo > 3 && status === "CONFIRMED" ? "DISPATCHED" : status,
      subtotal,
      discount: round2(subtotal - total),
      total,
      source: rand() > 0.55 ? "AI_AGENT" : "UI",
      createdBy: rand() > 0.5 ? "Aisha Rahman" : "Omar Haddad",
      createdAt: new Date(Date.now() - daysAgo * DAY - Math.floor(rand() * 8) * 3_600_000).toISOString(),
      notes: null,
      aiSummary: null,
      lines,
    });
  }
  return orders;
}

let ordersCache: SalesOrder[] | null = null;

function orders(): SalesOrder[] {
  if (ordersCache) return ordersCache;
  try {
    const stored = sessionStorage.getItem(ORDERS_KEY);
    ordersCache = stored ? (JSON.parse(stored) as SalesOrder[]) : seedOrders();
  } catch {
    ordersCache = seedOrders();
  }
  return ordersCache;
}

function saveOrders() {
  try {
    sessionStorage.setItem(ORDERS_KEY, JSON.stringify(orders()));
  } catch {
    // ignore: mock persistence is best-effort
  }
}

function findOrder(id: number) {
  const order = orders().find((o) => o.id === id);
  if (!order) throw new Problem(404, "Order not found", `Order ${id} does not exist.`);
  return order;
}

function reserve(order: SalesOrder, direction: 1 | -1) {
  const outlet = outlets.find((o) => o.id === order.outletId);
  if (!outlet) return;
  const warehouse = CITY_WAREHOUSE[outlet.city];
  for (const line of order.lines ?? []) {
    const s = inventory[line.sku]?.[warehouse];
    if (s) s.reserved = Math.max(0, s.reserved + direction * line.qtyCases);
  }
}

function createOrder(
  body: { outletId: number; lines: OrderLineInput[]; notes?: string; source?: SalesOrder["source"] },
  user: MockUser,
  idempotencyKey: string | null,
): SalesOrder {
  if (idempotencyKey && idempotency.has(idempotencyKey)) return findOrder(idempotency.get(idempotencyKey)!);
  const quote = priceQuote(body.outletId, body.lines);
  const short = quote.lines.filter((l) => !l.fulfillable);
  if (short.length) {
    throw new Problem(409, "Insufficient stock", `Not enough stock for ${short.map((l) => l.productName).join(", ")}.`);
  }
  const id = Math.max(0, ...orders().map((o) => o.id)) + 1;
  const order: SalesOrder = {
    id,
    orderNo: `SO-2026-${String(id).padStart(5, "0")}`,
    outletId: quote.outlet.id,
    outletName: quote.outlet.name,
    status: quote.creditStatus === "OK" ? "CONFIRMED" : "PENDING_APPROVAL",
    subtotal: quote.subtotal,
    discount: quote.discount,
    total: quote.total,
    source: body.source ?? "UI",
    createdBy: user.name,
    createdAt: new Date().toISOString(),
    notes: body.notes ?? null,
    aiSummary: null,
    lines: quote.lines.map(({ sku, productName, qtyCases, unitPrice, discountPct, lineTotal }) => ({
      sku,
      productName,
      qtyCases,
      unitPrice,
      discountPct,
      lineTotal,
    })),
  };
  if (order.status === "CONFIRMED") reserve(order, 1);
  orders().unshift(order);
  if (idempotencyKey) idempotency.set(idempotencyKey, id);
  saveOrders();
  return order;
}

function aiSummaryFor(order: SalesOrder): string {
  const outlet = outlets.find((o) => o.id === order.outletId)!;
  const lines = order.lines ?? [];
  const top = [...lines].sort((a, b) => b.lineTotal - a.lineTotal)[0];
  const headroom = outlet.creditLimit - outlet.outstandingBalance - order.total;
  const risk =
    headroom < 0
      ? `**Risk:** exceeds available credit by AED ${Math.abs(headroom).toLocaleString("en-US", { maximumFractionDigits: 0 })}. Confirm payment plan before approving.`
      : headroom < outlet.creditLimit * 0.1
        ? "**Risk:** outlet will be within 10% of its credit limit after this order."
        : "**Risk:** low. Credit headroom remains healthy.";
  return [
    `- ${outlet.name} (${outlet.channel.replace("_", " ").toLowerCase()}, ${outlet.city}) ordered ${lines.length} line${lines.length === 1 ? "" : "s"} totalling AED ${order.total.toLocaleString("en-US", { minimumFractionDigits: 2 })}.`,
    top ? `- Largest line: ${top.qtyCases} cases of ${top.productName}${top.discountPct ? ` with a ${top.discountPct}% promotion` : ""}.` : "- No lines on this order.",
    `- Placed via ${order.source === "AI_AGENT" ? "the AI agent" : "the web UI"} by ${order.createdBy}; status ${order.status.replace("_", " ").toLowerCase()}.`,
    "",
    risk,
  ].join("\n");
}

function dashboardSummary() {
  const all = orders();
  const live = all.filter((o) => o.status !== "CANCELLED");
  const today = isoDay(0);
  const month = today.slice(0, 7);
  const revenueByDay = Array.from({ length: 14 }, (_, i) => {
    const date = isoDay(i - 13);
    return { date, total: round2(live.filter((o) => o.createdAt.slice(0, 10) === date).reduce((s, o) => s + o.total, 0)) };
  });
  const productTotals = new Map<string, { sku: string; productName: string; qtyCases: number; revenue: number }>();
  for (const o of live) {
    for (const l of o.lines ?? []) {
      const t = productTotals.get(l.sku) ?? { sku: l.sku, productName: l.productName, qtyCases: 0, revenue: 0 };
      t.qtyCases += l.qtyCases;
      t.revenue = round2(t.revenue + l.lineTotal);
      productTotals.set(l.sku, t);
    }
  }
  const lowStock = products
    .flatMap((p) => WAREHOUSES.map((w) => ({ sku: p.sku, productName: p.name, warehouse: w, availableCases: available(p.sku, w) })))
    .filter((s) => s.availableCases < 25)
    .sort((a, b) => a.availableCases - b.availableCases);
  return {
    ordersToday: all.filter((o) => o.createdAt.slice(0, 10) === today).length,
    revenueMtd: round2(live.filter((o) => o.createdAt.startsWith(month)).reduce((s, o) => s + o.total, 0)),
    pendingApprovals: all.filter((o) => o.status === "PENDING_APPROVAL").length,
    lowStock,
    topProducts: [...productTotals.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5),
    ordersBySource: {
      UI: live.filter((o) => o.source === "UI").length,
      AI_AGENT: live.filter((o) => o.source === "AI_AGENT").length,
    },
    revenueByDay,
  };
}

// ── Knowledge base (mirrors ai-service/knowledge/*.md) ──────────────────────

const knowledge: Citation[] = [
  { doc: "credit-policy.md", title: "Credit approval policy", snippet: "Orders that take an outlet's outstanding balance above its credit limit are created as PENDING_APPROVAL. A sales manager must approve them before stock is reserved. Managers should check payment history for the last 90 days before approving." },
  { doc: "credit-policy.md", title: "Credit limit reviews", snippet: "Credit limits are reviewed quarterly. Outlets with two or more overdue invoices are placed on hold and cannot receive new confirmed orders until the balance is cleared." },
  { doc: "promotion-rules.md", title: "How promotions apply", snippet: "A promotion applies when the outlet channel matches (or the promotion is open to all channels), the line quantity meets the minimum cases, and today falls within the validity window. Only the single best discount applies per line; promotions never stack." },
  { doc: "promotion-rules.md", title: "Weekly juice specials", snippet: "Oasis Juice runs weekly specials, usually on 1L cartons. This week: 10% off Oasis Orange Juice 1L for 15+ cases (all channels) and 12% off Oasis Mango Nectar 250ml for HORECA outlets ordering 10+ cases." },
  { doc: "returns-policy.md", title: "Returns and damaged goods", snippet: "Damaged or expired stock can be returned within 7 days of delivery with photos attached. Credit notes are issued within 5 working days after the warehouse inspects the goods." },
  { doc: "product-guide.md", title: "Product range overview", snippet: "FizzUp (carbonated soft drinks), Oasis Juice (juices and nectars), Pure Peak Water (still and sparkling water) and VoltX Energy (energy drinks). VoltX Tropical 500ml is discontinued and can no longer be ordered." },
  { doc: "delivery-schedule.md", title: "Delivery schedule", snippet: "Orders confirmed before 2pm are delivered next working day from the outlet's city warehouse: DXB for Dubai, AUH for Abu Dhabi and SHJ for Sharjah. Friday orders ship on Monday." },
  { doc: "new-outlet-onboarding.md", title: "Onboarding a new outlet", snippet: "New outlets need a trade licence, VAT certificate and a signed credit application. Starting credit limits are AED 15,000 for grocery and HORECA, and AED 50,000 for modern trade." },
];

const STOPWORDS = new Set("a an and any are as at be by can do for from how i in is it me my of on or our the this to we what when which who why will with you your week".split(" "));
const tokenize = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9.\s-]/g, " ").split(/\s+/).filter((t) => t.length > 1 && !STOPWORDS.has(t));

function searchKnowledge(query: string, topK = 4): KnowledgeHit[] {
  const terms = tokenize(query);
  return knowledge
    .map((k) => {
      const haystack = tokenize(`${k.title} ${k.title} ${k.snippet}`);
      const score = terms.reduce((s, t) => s + haystack.filter((h) => h.startsWith(t.slice(0, 5))).length, 0);
      return { ...k, score: round2(score / Math.max(terms.length, 1)) };
    })
    .filter((k) => k.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

// ── Agent (deterministic stand-in for the LangGraph graph) ──────────────────

function scoreMatch(text: string, candidate: string) {
  const words = tokenize(text);
  const target = candidate.toLowerCase();
  return words.reduce((s, w) => s + (target.includes(w) ? w.length : 0), 0);
}

function resolveProduct(text: string): Product | null {
  const scored = products
    .map((p) => ({ p, score: scoreMatch(text, `${p.name} ${p.brand} ${p.sku}`) }))
    .sort((a, b) => b.score - a.score);
  return scored[0]?.score >= 4 ? scored[0].p : null;
}

function resolveOutlet(text: string): Outlet | null {
  const scored = outlets.map((o) => ({ o, score: scoreMatch(text, `${o.name} ${o.code}`) })).sort((a, b) => b.score - a.score);
  return scored[0]?.score >= 4 ? scored[0].o : null;
}

function chat(req: ChatRequest): ChatResponse {
  const text = [...req.messages].reverse().find((m) => m.role === "user")?.content.trim() ?? "";
  const steps: AgentStep[] = [];
  const empty = { quote: null, pending_action: null, order: null, citations: [] as Citation[] };
  const isOrder = /\b(order|send|deliver|book|place|need)\b/i.test(text) && /\d/.test(text);
  const isKnowledge =
    /\?|\b(policy|policies|promo|promotion|promotions|return|returns|delivery|deliver|credit|onboard|what|how|when|which|any)\b/i.test(text);

  if (isOrder) {
    steps.push({ node: "classify_intent", detail: "Intent ORDER (mentions a quantity and an order verb)" });
    const outletMatch = text.match(/\s+(?:for|to)\s+(.+?)\s*$/i);
    const outletPart = outletMatch?.[1] ?? "";
    const linePart = outletMatch ? text.slice(0, outletMatch.index) : text;
    // "20 cases of FizzUp Cola 330ml and 10 cases of …" → one segment per line, quantity first.
    const rawLines = linePart
      .replace(/^\s*(?:please\s+)?(?:order|send|deliver|book|place|need)\s+/i, "")
      .split(/\s*,\s*|\s+and\s+/i)
      .map((segment) => segment.match(/^\s*(\d+)\s*(?:cases?|ctns?|cartons?|x)?\s+(?:of\s+)?(.+?)\s*$/i))
      .filter((m): m is RegExpMatchArray => m !== null);
    steps.push({
      node: "extract_order",
      detail: `Extracted outlet "${outletPart || "?"}" and ${rawLines.length} line(s): ${rawLines.map((m) => `${m[1]} × "${m[2].trim()}"`).join("; ") || "none"}`,
    });

    const outlet = req.outlet_id ? outlets.find((o) => o.id === req.outlet_id) ?? null : resolveOutlet(outletPart || text);
    const lines = rawLines
      .map((m) => ({ product: resolveProduct(m[2]), qty: Number(m[1]), ref: m[2].trim() }))
      .filter((l) => l.qty > 0);
    const unresolved = lines.filter((l) => !l.product).map((l) => l.ref);
    steps.push({
      node: "resolve_entities",
      detail: `GET /api/outlets?q=… → ${outlet ? `${outlet.name} (${outlet.code})` : "no match"}; GET /api/products?q=… → ${lines
        .map((l) => l.product?.sku ?? `no match for "${l.ref}"`)
        .join(", ")}`,
    });

    if (!outlet || !lines.length || unresolved.length) {
      const problems = [
        !outlet && "which **outlet** this is for",
        !lines.length && "the **products and quantities**",
        unresolved.length && `which product you mean by ${unresolved.map((u) => `"${u}"`).join(", ")}`,
      ].filter(Boolean);
      return {
        ...empty,
        intent: "ORDER",
        reply: `I can prepare that order, but I need to know ${problems.join(" and ")}.\n\nTry something like: *Order 20 cases of FizzUp Cola 330ml for Al Noor Grocery*.`,
        steps: [...steps, { node: "propose", detail: "Asked a clarifying question instead of quoting" }],
      };
    }

    const orderLines = lines.map((l) => ({ sku: l.product!.sku, qtyCases: l.qty }));
    let quote: Quote;
    try {
      quote = priceQuote(outlet.id, orderLines);
    } catch (error) {
      const detail = error instanceof Problem ? error.detail : "Pricing failed.";
      return {
        ...empty,
        intent: "ORDER",
        reply: `I couldn't quote that order: ${detail}`,
        steps: [...steps, { node: "quote", detail: `POST /api/orders/quote → ${detail}` }],
      };
    }
    steps.push({
      node: "quote",
      detail: `POST /api/orders/quote → total AED ${quote.total.toFixed(2)}, credit ${quote.creditStatus}, ${quote.warnings.length} warning(s)`,
    });
    steps.push({ node: "propose", detail: "Returned a confirmation card. The order is NOT placed until the rep confirms." });

    const blocked = quote.lines.some((l) => !l.fulfillable);
    const promoCount = quote.lines.filter((l) => l.promotion).length;
    return {
      ...empty,
      intent: "ORDER",
      reply: [
        `Here's the quote for **${outlet.name}** (${outlet.code}, ${outlet.city}).`,
        promoCount ? `${promoCount} promotion${promoCount > 1 ? "s" : ""} applied, saving **AED ${quote.discount.toFixed(2)}**.` : "No promotions apply at these quantities.",
        blocked
          ? "Some lines can't be fulfilled from the local warehouse. Please **Edit** the quantities before confirming."
          : quote.creditStatus === "NEEDS_APPROVAL"
            ? "This goes over the outlet's credit limit, so it will be sent to a manager for approval once you confirm."
            : "Review the lines below and **Confirm** to place the order.",
      ].join(" "),
      quote,
      steps,
      pending_action: blocked ? null : { type: "PLACE_ORDER", payload: { outletId: outlet.id, lines: orderLines, source: "AI_AGENT" } },
    };
  }

  if (isKnowledge) {
    steps.push({ node: "classify_intent", detail: "Intent KNOWLEDGE (policy / promotion question)" });
    const hits = searchKnowledge(text, 3);
    steps.push({ node: "retrieve", detail: `Local BM25 search → ${hits.length} passage(s): ${hits.map((h) => h.doc).join(", ") || "none"}` });
    const citations = hits.map(({ doc, title, snippet }) => ({ doc, title, snippet }));
    steps.push({ node: "answer_with_citations", detail: `Answered from ${citations.length} cited source(s)` });

    let reply: string;
    const brand = products.find((p) => text.toLowerCase().includes(p.brand.toLowerCase().split(" ")[0]))?.brand;
    if (/promo|promotion|deal|discount/i.test(text)) {
      const today = isoDay(0);
      const live = promotions.filter(
        (p) => p.validFrom <= today && today <= p.validTo && (!brand || products.find((x) => x.sku === p.sku)?.brand === brand),
      );
      reply = live.length
        ? `${brand ? `Active **${brand}** promotions` : "Active promotions"} right now:\n\n${live
            .map(
              (p) =>
                `- **${products.find((x) => x.sku === p.sku)?.name}**: ${p.discountPct}% off ${p.minCases}+ cases${p.channel ? ` (${p.channel.replace("_", " ").toLowerCase()} only)` : ""}, until ${p.validTo}`,
            )
            .join("\n")}\n\nOnly the best single promotion applies per line; they don't stack [promotion-rules.md].`
        : `There are no active promotions${brand ? ` on ${brand}` : ""} this week.`;
    } else if (hits.length) {
      reply = `${hits[0].snippet} [${hits[0].doc}]${hits[1] ? `\n\nRelated: ${hits[1].snippet} [${hits[1].doc}]` : ""}`;
    } else {
      reply = "I couldn't find that in the policy documents. Try asking about credit, promotions, returns, delivery or onboarding.";
    }
    return { ...empty, intent: "KNOWLEDGE", reply, citations, steps };
  }

  steps.push({ node: "classify_intent", detail: "Intent GENERAL" });
  steps.push({ node: "general_answer", detail: "Short helpful answer, no tools needed" });
  return {
    ...empty,
    intent: "GENERAL",
    reply:
      "I'm OrderPilot, your ordering copilot. I can:\n\n- **Quote and place orders**: *Order 20 cases of FizzUp Cola 330ml for Al Noor Grocery*\n- **Answer policy questions**: *What is the credit approval policy?*\n- **Check promotions**: *Any promotions on Oasis Juice this week?*\n\nI'll always show you a quote to confirm before anything is ordered.",
    steps,
  };
}

// ── Prompt Studio ───────────────────────────────────────────────────────────

function promptStudio(requirement: string, layer: PromptLayer): PromptStudioResponse {
  const text = requirement.trim();
  const find = (dict: Record<string, string>) =>
    Object.entries(dict)
      .filter(([k]) => new RegExp(`\\b${k}`, "i").test(text))
      .map(([, v]) => v);
  const actors = find({ rep: "Sales rep", manager: "Sales manager", customer: "Outlet owner", outlet: "Outlet owner", warehouse: "Warehouse team", finance: "Finance team", admin: "Administrator" });
  const entities = find({ order: "SalesOrder", outlet: "Outlet", product: "Product", promo: "Promotion", stock: "Inventory", inventory: "Inventory", invoice: "Invoice", return: "ReturnRequest", credit: "Outlet.creditLimit", delivery: "DeliverySlot" });
  const rules = text
    .split(/(?<=[.!?])\s+|\n+/)
    .filter((s) => /\b(must|should|only|if|when|unless|cannot|never|at least|more than|less than|over|under)\b/i.test(s))
    .map((s) => s.trim().replace(/[.]$/, ""));
  const layerStack: Record<PromptLayer, string> = {
    backend: "Java 21, Spring Boot 3, Spring Data JPA, Flyway, Spring Security (JWT resource server)",
    frontend: "Next.js App Router, TypeScript (strict), Tailwind CSS, TanStack Query; mobile-first PWA",
    ai: "Python 3.12, FastAPI, LangGraph, Anthropic SDK with Azure OpenAI fallback, Azure AI Search",
    fullstack: "Spring Boot core-api + FastAPI ai-service + Next.js PWA, per docs/SPEC.md",
  };
  const acceptance = [
    ...rules.slice(0, 4).map((r) => `Given the rule "${r}", when it is violated, then the request is rejected with an RFC 7807 error that explains why.`),
    `Happy path is covered by an automated ${layer === "frontend" ? "component/E2E" : "integration"} test.`,
    "Every new endpoint or screen enforces the REP / MANAGER role model.",
    "Lint, typecheck and the full test suite pass in CI.",
  ];
  const open_questions = [
    !actors.length && "Who is the primary user of this feature?",
    !rules.length && "What validation or business rules apply?",
    "What should happen when a dependent service (core-api / AI provider) is unavailable?",
    /approv/i.test(text) ? "Who can approve, and is there an amount threshold?" : "Does this need an audit trail?",
  ].filter((q): q is string => Boolean(q));

  const prompt = `# Role
You are a senior ${layer === "ai" ? "AI engineer" : layer === "frontend" ? "frontend engineer" : layer === "backend" ? "backend engineer" : "full-stack engineer"} working on OrderPilot, an AI sales and ordering copilot for an FMCG beverage distributor (currency AED).

# Context
- Stack: ${layerStack[layer]}.
- Contract: follow \`docs/SPEC.md\` exactly; don't invent endpoints or fields.
- Actors: ${actors.join(", ") || "TBD"}.
- Entities: ${entities.join(", ") || "TBD"}.

# Requirement
${text}

# Business rules
${rules.length ? rules.map((r, i) => `${i + 1}. ${r}.`).join("\n") : "1. (none stated: ask before assuming)"}

# Task
1. Restate the requirement in one paragraph and list assumptions.
2. Propose the design (data model changes, API or UI changes) before writing code.
3. Implement it in small, reviewable steps with tests alongside each step.
4. Return errors as RFC 7807 problem details; never swallow exceptions.

# Constraints
- Keep changes scoped to the ${layer} layer unless the contract requires otherwise.
- No secrets in code; read configuration from environment variables.
- Prefer clarity over cleverness: this code will be reviewed by humans.

# Acceptance criteria
${acceptance.map((a) => `- [ ] ${a}`).join("\n")}

# Output format
Return a short plan, then the code as complete files with paths, then the test commands to run.`;

  return { analysis: { actors, entities, rules, open_questions }, prompt, acceptance_criteria: acceptance };
}

// ── Router ──────────────────────────────────────────────────────────────────

interface MockUser {
  sub: string;
  name: string;
  roles: Role[];
}

const DEMO_USERS: Record<Role, MockUser> = {
  REP: { sub: "rep-001", name: "Aisha Rahman", roles: ["REP"] },
  MANAGER: { sub: "mgr-001", name: "Omar Haddad", roles: ["MANAGER"] },
};

const b64url = (value: object) => btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function mockToken(user: MockUser) {
  const now = Math.floor(Date.now() / 1000);
  return `${b64url({ alg: "none", typ: "JWT" })}.${b64url({ ...user, iss: "orderpilot-demo", iat: now, exp: now + 8 * 3600 })}.mock`;
}

function userFromAuthHeader(headers: Headers): MockUser {
  const token = headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const payload = token?.split(".")[1];
  if (!payload) throw new Problem(401, "Unauthorized", "Sign in to continue.");
  try {
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as MockUser;
  } catch {
    throw new Problem(401, "Unauthorized", "Your session token is invalid. Please sign in again.");
  }
}

function requireRole(user: MockUser, ...roles: Role[]) {
  if (!user.roles.some((r) => roles.includes(r))) {
    throw new Problem(403, "Forbidden", `This action requires the ${roles.join(" or ")} role.`);
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function wait(ms: number, signal?: AbortSignal | null) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });
}

export async function mockFetch(service: "core" | "ai", pathWithQuery: string, init: RequestInit): Promise<Response> {
  const url = new URL(pathWithQuery, "http://mock.local");
  const path = url.pathname;
  const q = url.searchParams;
  const method = init.method ?? "GET";
  const headers = new Headers(init.headers);
  const body = init.body ? JSON.parse(String(init.body)) : undefined;

  // Simulated latency; AI calls are a little slower, like the real thing.
  await wait(config.mockLatencyMs * (service === "ai" ? 1.8 : 1) * (0.6 + Math.random() * 0.8), init.signal);

  try {
    // Public endpoints
    if (path === "/api/health") return json({ status: "UP", service: "core-api", version: "mock" });
    if (path === "/ai/health") return json({ status: "ok", llm_provider: "mock", search_provider: "local" });
    if (path === "/api/auth/demo-login" && method === "POST") {
      const user = DEMO_USERS[(body?.role as Role) ?? "REP"];
      if (!user) throw new Problem(400, "Invalid role", "Role must be REP or MANAGER.");
      return json({ token: mockToken(user), user: { id: user.sub, name: user.name, roles: user.roles } });
    }

    const user = userFromAuthHeader(headers);
    let m: RegExpMatchArray | null;

    if (path === "/api/me") return json({ id: user.sub, name: user.name, roles: user.roles });

    if (path === "/api/outlets") {
      const term = (q.get("q") ?? "").toLowerCase();
      return json(outlets.filter((o) => `${o.name} ${o.code} ${o.city}`.toLowerCase().includes(term)));
    }
    if ((m = path.match(/^\/api\/outlets\/(\d+)$/))) {
      const outlet = outlets.find((o) => o.id === Number(m![1]));
      if (!outlet) throw new Problem(404, "Outlet not found", `Outlet ${m[1]} does not exist.`);
      return json({ ...outlet, availableCredit: outlet.creditLimit - outlet.outstandingBalance });
    }

    if (path === "/api/products") {
      const term = (q.get("q") ?? "").toLowerCase();
      const category = q.get("category");
      return json(
        products.filter(
          (p) => `${p.name} ${p.brand} ${p.sku}`.toLowerCase().includes(term) && (!category || p.category === category),
        ),
      );
    }
    if ((m = path.match(/^\/api\/products\/([^/]+)$/))) {
      const product = products.find((p) => p.sku === decodeURIComponent(m![1]));
      if (!product) throw new Problem(404, "Product not found", `SKU ${m[1]} does not exist.`);
      return json({
        ...product,
        stock: WAREHOUSES.map((w) => ({
          warehouse: w,
          onHandCases: inventory[product.sku][w].onHand,
          reservedCases: inventory[product.sku][w].reserved,
        })),
      });
    }

    if (path === "/api/orders/quote" && method === "POST") {
      requireRole(user, "REP", "MANAGER");
      return json(priceQuote(body.outletId, body.lines));
    }
    if (path === "/api/orders" && method === "POST") {
      requireRole(user, "REP", "MANAGER");
      return json(createOrder(body, user, headers.get("idempotency-key")), 201);
    }
    if (path === "/api/orders") {
      const status = q.get("status");
      const outletId = q.get("outletId");
      const page = Number(q.get("page") ?? 0);
      const size = Number(q.get("size") ?? 20);
      const filtered = orders()
        .filter((o) => (!status || o.status === status) && (!outletId || o.outletId === Number(outletId)))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      // Spring Data Page shape, as core-api returns it.
      return json({
        content: filtered.slice(page * size, page * size + size).map((o) => ({ ...o, lines: undefined })),
        number: page,
        size,
        totalElements: filtered.length,
        totalPages: Math.max(1, Math.ceil(filtered.length / size)),
      });
    }
    if ((m = path.match(/^\/api\/orders\/(\d+)$/))) return json(findOrder(Number(m[1])));
    if ((m = path.match(/^\/api\/orders\/(\d+)\/approve$/)) && method === "POST") {
      requireRole(user, "MANAGER");
      const order = findOrder(Number(m[1]));
      if (order.status !== "PENDING_APPROVAL") {
        throw new Problem(409, "Invalid state", `Order ${order.orderNo} is ${order.status}, not PENDING_APPROVAL.`);
      }
      order.status = "CONFIRMED";
      reserve(order, 1);
      saveOrders();
      return json(order);
    }
    if ((m = path.match(/^\/api\/orders\/(\d+)\/cancel$/)) && method === "POST") {
      requireRole(user, "REP", "MANAGER");
      const order = findOrder(Number(m[1]));
      if (order.status === "CANCELLED" || order.status === "DISPATCHED") {
        throw new Problem(409, "Invalid state", `Order ${order.orderNo} is ${order.status} and can't be cancelled.`);
      }
      if (order.status === "CONFIRMED") reserve(order, -1);
      order.status = "CANCELLED";
      saveOrders();
      return json(order);
    }
    if ((m = path.match(/^\/api\/orders\/(\d+)\/ai-summary$/)) && method === "POST") {
      const order = findOrder(Number(m[1]));
      await wait(config.mockLatencyMs * 2);
      order.aiSummary = aiSummaryFor(order);
      saveOrders();
      return json(order);
    }

    if (path === "/api/dashboard/summary") {
      requireRole(user, "MANAGER");
      return json(dashboardSummary());
    }

    if (path === "/ai/chat" && method === "POST") return json(chat(body as ChatRequest));
    if (path === "/ai/chat/confirm" && method === "POST") {
      const { session_id, pending_action } = body as ConfirmRequest;
      const payload = pending_action.payload as { outletId: number; lines: OrderLineInput[]; notes?: string };
      const key = `${session_id}:${JSON.stringify(payload.lines)}:${payload.outletId}`;
      const order = createOrder({ ...payload, source: "AI_AGENT" }, user, key);
      return json({
        reply:
          order.status === "CONFIRMED"
            ? `Order **${order.orderNo}** is confirmed for ${order.outletName}. Total **AED ${order.total.toFixed(2)}**; stock has been reserved.`
            : `Order **${order.orderNo}** was created and is **waiting for manager approval** because it exceeds ${order.outletName}'s credit limit.`,
        order,
      });
    }
    if (path === "/ai/knowledge/search" && method === "POST") {
      return json({ hits: searchKnowledge(String(body?.query ?? ""), Number(body?.top_k ?? 4)) });
    }
    if (path === "/ai/prompt-studio" && method === "POST") {
      if (!String(body?.requirement ?? "").trim()) {
        return json({ detail: [{ loc: ["body", "requirement"], msg: "Requirement must not be empty" }] }, 422);
      }
      return json(promptStudio(String(body.requirement), (body.layer ?? "fullstack") as PromptLayer));
    }

    throw new Problem(404, "Not found", `No mock for ${method} ${path}.`);
  } catch (error) {
    if (error instanceof Problem) {
      return new Response(
        JSON.stringify({ type: "about:blank", title: error.title, status: error.status, detail: error.detail }),
        { status: error.status, headers: { "Content-Type": "application/problem+json" } },
      );
    }
    throw error;
  }
}
