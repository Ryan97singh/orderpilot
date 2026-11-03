/**
 * Types mirroring docs/SPEC.md. Where the spec leaves a shape open, the chosen shape is
 * documented in README → "Contract notes" and normalised in lib/api.ts.
 */

// ── Auth ────────────────────────────────────────────────────────────────────

export type Role = "REP" | "MANAGER";

export interface User {
  id: string;
  name: string;
  roles: Role[];
  email?: string;
}

export interface DemoLoginRequest {
  role: Role;
}

export interface DemoLoginResponse {
  token: string;
  user: User;
}

// ── Core domain ─────────────────────────────────────────────────────────────

export type Channel = "GROCERY" | "HORECA" | "MODERN_TRADE";
export type Category = "CARBONATED" | "JUICE" | "WATER" | "ENERGY";
export type Warehouse = "DXB" | "AUH" | "SHJ";
export type OrderStatus = "PENDING_APPROVAL" | "CONFIRMED" | "DISPATCHED" | "CANCELLED";
export type OrderSource = "UI" | "AI_AGENT";
export type CreditStatus = "OK" | "NEEDS_APPROVAL";

export interface Outlet {
  id: number;
  code: string;
  name: string;
  channel: Channel;
  city: string;
  creditLimit: number;
  outstandingBalance: number;
  salesRepId: string | number | null;
  /** Present on GET /api/outlets/{id}. */
  availableCredit?: number;
}

export interface StockLevel {
  warehouse: Warehouse;
  onHandCases: number;
  reservedCases: number;
  /** onHand - reserved; computed client-side when the API omits it. */
  availableCases: number;
}

export interface Product {
  sku: string;
  name: string;
  brand: string;
  category: Category;
  packSize: string;
  casePrice: number;
  active: boolean;
  /** Present on GET /api/products/{sku}. */
  stock?: StockLevel[];
}

export interface Promotion {
  id: number;
  sku: string;
  channel: Channel | null;
  discountPct: number;
  minCases: number;
  validFrom: string;
  validTo: string;
  description: string;
}

export interface OrderLineInput {
  sku: string;
  qtyCases: number;
}

export interface QuoteRequest {
  outletId: number;
  lines: OrderLineInput[];
}

export interface CreateOrderRequest extends QuoteRequest {
  notes?: string;
  source?: OrderSource;
}

export interface QuoteLine {
  sku: string;
  productName: string;
  qtyCases: number;
  unitPrice: number;
  discountPct: number;
  /** The applied promotion; the spec doesn't fix its shape, so a plain label is accepted too. */
  promotion: Promotion | string | null;
  lineTotal: number;
  available: number;
  fulfillable: boolean;
}

export interface Quote {
  outlet: Outlet;
  lines: QuoteLine[];
  subtotal: number;
  discount: number;
  total: number;
  creditStatus: CreditStatus;
  warnings: string[];
}

export interface OrderLine {
  sku: string;
  productName: string;
  qtyCases: number;
  unitPrice: number;
  discountPct: number;
  lineTotal: number;
}

export interface SalesOrder {
  id: number;
  orderNo: string;
  outletId: number;
  /** Not in the spec's entity list; shown when the API includes it, otherwise resolved via /api/outlets. */
  outletName?: string;
  status: OrderStatus;
  subtotal: number;
  discount: number;
  total: number;
  source: OrderSource;
  createdBy: string;
  createdAt: string;
  notes: string | null;
  aiSummary: string | null;
  lines?: OrderLine[];
}

export interface OrderListParams {
  outletId?: number;
  status?: OrderStatus;
  page?: number;
  size?: number;
}

export interface Page<T> {
  items: T[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
}

export interface LowStockItem {
  sku: string;
  productName: string;
  warehouse: Warehouse | string;
  availableCases: number;
}

export interface TopProduct {
  sku: string;
  productName: string;
  qtyCases: number;
  revenue: number;
}

export interface DashboardSummary {
  ordersToday: number;
  revenueMtd: number;
  pendingApprovals: number;
  lowStock: LowStockItem[];
  topProducts: TopProduct[];
  ordersBySource: Record<OrderSource, number>;
  revenueByDay: { date: string; total: number }[];
}

export interface HealthResponse {
  status: string;
  [key: string]: unknown;
}

// ── AI service ──────────────────────────────────────────────────────────────

export type ChatRole = "user" | "assistant";
export type Intent = "ORDER" | "KNOWLEDGE" | "GENERAL";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatRequest {
  session_id: string;
  messages: ChatMessage[];
  outlet_id: number | null;
}

export interface PendingAction {
  type: "PLACE_ORDER";
  payload: Record<string, unknown>;
}

export interface Citation {
  doc: string;
  title: string;
  snippet: string;
}

export interface AgentStep {
  node: string;
  detail: string;
}

export interface ChatResponse {
  reply: string;
  intent: Intent;
  quote: Quote | null;
  pending_action: PendingAction | null;
  order: SalesOrder | null;
  citations: Citation[];
  steps: AgentStep[];
}

export interface ConfirmRequest {
  session_id: string;
  pending_action: PendingAction;
}

export interface ConfirmResponse {
  reply: string;
  order: SalesOrder;
}

export interface KnowledgeSearchRequest {
  query: string;
  top_k?: number;
}

export interface KnowledgeHit extends Citation {
  score: number;
}

export type PromptLayer = "backend" | "frontend" | "ai" | "fullstack";

export interface PromptStudioRequest {
  requirement: string;
  layer: PromptLayer;
}

export interface PromptStudioResponse {
  analysis: {
    actors: string[];
    entities: string[];
    rules: string[];
    open_questions: string[];
  };
  prompt: string;
  acceptance_criteria: string[];
}

// ── Errors ──────────────────────────────────────────────────────────────────

/** RFC 7807 problem details. */
export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
}
