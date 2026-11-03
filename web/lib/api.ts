/**
 * Typed client for core-api (/api) and ai-service (/ai), per docs/SPEC.md.
 *
 * Every call:
 *  - attaches `Authorization: Bearer <token>` (demo JWT or Entra access token) and `X-Request-Id`;
 *  - turns non-2xx responses (RFC 7807 problem+json) into an ApiError with a readable message;
 *  - reports slow (>5s) and unreachable calls to lib/network-status for the cold-start banner.
 *
 * With NEXT_PUBLIC_USE_MOCKS=true, responses come from lib/mocks.ts but still flow through
 * the same header, error and timing handling.
 */
import { ApiError, apiErrorFromResponse } from "@/lib/api-error";
import { getAccessToken, notifyUnauthorized } from "@/lib/auth/session";
import { userFromClaims, decodeJwt } from "@/lib/auth/jwt";
import { config } from "@/lib/config";
import { networkStatus } from "@/lib/network-status";
import type {
  Category,
  ChatRequest,
  ChatResponse,
  ConfirmRequest,
  ConfirmResponse,
  CreateOrderRequest,
  DashboardSummary,
  DemoLoginResponse,
  HealthResponse,
  KnowledgeHit,
  KnowledgeSearchRequest,
  LowStockItem,
  OrderListParams,
  Outlet,
  Page,
  Product,
  PromptStudioRequest,
  PromptStudioResponse,
  Quote,
  QuoteRequest,
  Role,
  SalesOrder,
  StockLevel,
  TopProduct,
  User,
} from "@/lib/types";

export { ApiError } from "@/lib/api-error";

export type Service = "core" | "ai";

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | undefined | null>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Attach the bearer token (default true). */
  auth?: boolean;
}

function baseUrl(service: Service) {
  return service === "core" ? config.coreApiUrl : config.aiApiUrl;
}

export function newRequestId(): string {
  // randomUUID needs a secure context; plain-HTTP LAN testing on a phone falls back.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function withQuery(path: string, query: RequestOptions["query"]) {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

async function request<T>(service: Service, path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, query, signal, auth = true } = options;
  const requestId = newRequestId();
  const fullPath = withQuery(path, query);

  const headers = new Headers({
    Accept: "application/json, application/problem+json",
    "X-Request-Id": requestId,
    ...options.headers,
  });
  if (body !== undefined) headers.set("Content-Type", "application/json");
  if (auth) {
    const token = await getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  // Combine the caller's signal (e.g. TanStack Query cancellation) with our own timeout.
  const controller = new AbortController();
  let timedOut = false;
  const onCallerAbort = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", onCallerAbort, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, config.requestTimeoutMs);

  let slow = false;
  const slowTimer = setTimeout(() => {
    slow = true;
    networkStatus.slowStarted();
  }, config.slowRequestMs);

  let response: Response;
  try {
    const init: RequestInit = {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    };
    response = config.useMocks
      ? await (await import("@/lib/mocks")).mockFetch(service, fullPath, init)
      : await fetch(`${baseUrl(service)}${fullPath}`, init);
  } catch (error) {
    if (signal?.aborted) throw error; // cancelled by the caller: not a server problem
    networkStatus.markUnreachable();
    throw new ApiError({
      status: 0,
      title: timedOut ? "Timeout" : "Network error",
      message: timedOut
        ? "The server took too long to respond. It may still be waking up. Please retry."
        : typeof navigator !== "undefined" && !navigator.onLine
          ? "You're offline. Check your connection and try again."
          : "Couldn't reach the server. It may be waking up. Please retry in a few seconds.",
      requestId,
    });
  } finally {
    clearTimeout(timeout);
    clearTimeout(slowTimer);
    signal?.removeEventListener("abort", onCallerAbort);
    if (slow) networkStatus.slowFinished();
  }

  networkStatus.markReachable();

  if (!response.ok) {
    const error = await apiErrorFromResponse(response, requestId);
    if (error.status === 401 && auth) notifyUnauthorized();
    throw error;
  }
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

// ── Normalisers for shapes the spec leaves open (see README → Contract notes) ──

type Raw = Record<string, unknown>;

function toPage<T>(raw: unknown, fallbackSize: number): Page<T> {
  if (Array.isArray(raw)) {
    return { items: raw as T[], page: 0, size: raw.length, totalItems: raw.length, totalPages: 1 };
  }
  const r = (raw ?? {}) as Raw;
  // Spring Data `Page` → { content, number, size, totalElements, totalPages }
  const items = (r.content ?? r.items ?? []) as T[];
  const size = Number(r.size ?? fallbackSize);
  const totalItems = Number(r.totalElements ?? r.totalItems ?? items.length);
  return {
    items,
    page: Number(r.number ?? r.page ?? 0),
    size,
    totalItems,
    totalPages: Number(r.totalPages ?? Math.max(1, Math.ceil(totalItems / Math.max(size, 1)))),
  };
}

function toStock(raw: unknown): StockLevel[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw.map((s: Raw) => {
    const onHand = Number(s.onHandCases ?? 0);
    const reserved = Number(s.reservedCases ?? 0);
    return {
      warehouse: s.warehouse as StockLevel["warehouse"],
      onHandCases: onHand,
      reservedCases: reserved,
      availableCases: Number(s.availableCases ?? s.available ?? onHand - reserved),
    };
  });
}

function toProduct(raw: Raw): Product {
  const stock = toStock(raw.stock ?? raw.inventory ?? raw.stockByWarehouse);
  return { ...(raw as unknown as Product), stock };
}

function toDashboard(raw: Raw): DashboardSummary {
  const lowStock = ((raw.lowStock ?? []) as Raw[]).map<LowStockItem>((s) => ({
    sku: String(s.sku),
    productName: String(s.productName ?? s.name ?? s.sku),
    warehouse: String(s.warehouse ?? "—"),
    availableCases: Number(
      s.availableCases ?? s.available ?? Number(s.onHandCases ?? 0) - Number(s.reservedCases ?? 0),
    ),
  }));
  const topProducts = ((raw.topProducts ?? []) as Raw[]).map<TopProduct>((p) => ({
    sku: String(p.sku),
    productName: String(p.productName ?? p.name ?? p.sku),
    qtyCases: Number(p.qtyCases ?? p.cases ?? p.quantity ?? 0),
    revenue: Number(p.revenue ?? p.total ?? 0),
  }));
  const bySource = (raw.ordersBySource ?? {}) as Raw;
  return {
    ordersToday: Number(raw.ordersToday ?? 0),
    revenueMtd: Number(raw.revenueMtd ?? 0),
    pendingApprovals: Number(raw.pendingApprovals ?? 0),
    lowStock,
    topProducts,
    ordersBySource: { UI: Number(bySource.UI ?? 0), AI_AGENT: Number(bySource.AI_AGENT ?? 0) },
    revenueByDay: ((raw.revenueByDay ?? []) as Raw[]).map((d) => ({ date: String(d.date), total: Number(d.total) })),
  };
}

function toUser(raw: Partial<User> | undefined, token: string): User {
  return userFromClaims(decodeJwt(token) ?? {}, raw);
}

// ── Endpoints ───────────────────────────────────────────────────────────────

export const api = {
  health: {
    core: (signal?: AbortSignal) => request<HealthResponse>("core", "/api/health", { auth: false, signal }),
    ai: (signal?: AbortSignal) => request<HealthResponse>("ai", "/ai/health", { auth: false, signal }),
  },

  auth: {
    async demoLogin(role: Role): Promise<DemoLoginResponse> {
      const res = await request<DemoLoginResponse>("core", "/api/auth/demo-login", {
        method: "POST",
        body: { role },
        auth: false,
      });
      return { token: res.token, user: toUser(res.user, res.token) };
    },
    me: () => request<User>("core", "/api/me"),
  },

  outlets: {
    search: (q?: string, signal?: AbortSignal) => request<Outlet[]>("core", "/api/outlets", { query: { q }, signal }),
    get: (id: number, signal?: AbortSignal) => request<Outlet>("core", `/api/outlets/${id}`, { signal }),
  },

  products: {
    async search(params: { q?: string; category?: Category | "" } = {}, signal?: AbortSignal) {
      const raw = await request<Raw[]>("core", "/api/products", { query: params, signal });
      return raw.map(toProduct);
    },
    async get(sku: string, signal?: AbortSignal) {
      return toProduct(await request<Raw>("core", `/api/products/${encodeURIComponent(sku)}`, { signal }));
    },
  },

  orders: {
    quote: (body: QuoteRequest) => request<Quote>("core", "/api/orders/quote", { method: "POST", body }),
    create: (body: CreateOrderRequest, idempotencyKey: string) =>
      request<SalesOrder>("core", "/api/orders", {
        method: "POST",
        body,
        headers: { "Idempotency-Key": idempotencyKey },
      }),
    async list(params: OrderListParams = {}, signal?: AbortSignal) {
      const size = params.size ?? 20;
      const raw = await request<unknown>("core", "/api/orders", { query: { ...params, size }, signal });
      return toPage<SalesOrder>(raw, size);
    },
    get: (id: number, signal?: AbortSignal) => request<SalesOrder>("core", `/api/orders/${id}`, { signal }),
    approve: (id: number) => request<SalesOrder>("core", `/api/orders/${id}/approve`, { method: "POST" }),
    cancel: (id: number) => request<SalesOrder>("core", `/api/orders/${id}/cancel`, { method: "POST" }),
    aiSummary: (id: number) => request<SalesOrder>("core", `/api/orders/${id}/ai-summary`, { method: "POST" }),
  },

  dashboard: {
    summary: async (signal?: AbortSignal) => toDashboard(await request<Raw>("core", "/api/dashboard/summary", { signal })),
  },

  ai: {
    chat: (body: ChatRequest, signal?: AbortSignal) =>
      request<ChatResponse>("ai", "/ai/chat", { method: "POST", body, signal }),
    confirm: (body: ConfirmRequest) => request<ConfirmResponse>("ai", "/ai/chat/confirm", { method: "POST", body }),
    async knowledgeSearch(body: KnowledgeSearchRequest, signal?: AbortSignal) {
      const raw = await request<unknown>("ai", "/ai/knowledge/search", { method: "POST", body, signal });
      // Accept either a bare array or `{ hits: [...] }` / `{ results: [...] }`.
      if (Array.isArray(raw)) return raw as KnowledgeHit[];
      const r = (raw ?? {}) as Raw;
      return (r.hits ?? r.results ?? []) as KnowledgeHit[];
    },
    promptStudio: (body: PromptStudioRequest) =>
      request<PromptStudioResponse>("ai", "/ai/prompt-studio", { method: "POST", body }),
  },
};
