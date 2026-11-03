import type { ProblemDetails } from "@/lib/types";

/** An API failure with a human-readable `message`, built from RFC 7807 problem details when present. */
export class ApiError extends Error {
  readonly status: number;
  readonly title: string;
  readonly detail?: string;
  readonly type?: string;
  readonly requestId: string;

  constructor(init: { status: number; title: string; message: string; detail?: string; type?: string; requestId: string }) {
    super(init.message);
    this.name = "ApiError";
    this.status = init.status;
    this.title = init.title;
    this.detail = init.detail;
    this.type = init.type;
    this.requestId = init.requestId;
  }

  /** True when the server was never reached (offline, DNS, CORS, timeout). */
  get isNetworkError() {
    return this.status === 0;
  }
}

const FALLBACK_MESSAGES: Record<number, string> = {
  400: "The request wasn't valid. Please check the details and try again.",
  401: "Your session has expired. Please sign in again.",
  403: "You don't have permission to do that.",
  404: "We couldn't find what you were looking for.",
  409: "That conflicts with the current state. Refresh and try again.",
  422: "Some of the details couldn't be processed.",
  429: "Too many requests. Please wait a moment and try again.",
};

/** FastAPI validation errors arrive as `{ detail: [{ loc, msg }] }` rather than RFC 7807. */
function fastApiDetail(detail: unknown): string | undefined {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => (item && typeof item === "object" && "msg" in item ? String(item.msg) : null))
      .filter(Boolean);
    return messages.length ? messages.join("; ") : undefined;
  }
  return undefined;
}

export async function apiErrorFromResponse(response: Response, requestId: string): Promise<ApiError> {
  let problem: ProblemDetails & { detail?: unknown; message?: unknown } = {};
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("json")) {
    try {
      problem = await response.json();
    } catch {
      // Body wasn't valid JSON; fall through to status-based messages.
    }
  }

  const detail = fastApiDetail(problem.detail) ?? (typeof problem.message === "string" ? problem.message : undefined);
  const title = problem.title ?? (response.statusText || `HTTP ${response.status}`);
  const message =
    detail ??
    (problem.title && response.status < 500 ? problem.title : undefined) ??
    FALLBACK_MESSAGES[response.status] ??
    (response.status >= 500
      ? "The server ran into a problem. Please try again in a moment."
      : `Request failed (${response.status}).`);

  return new ApiError({
    status: problem.status ?? response.status,
    title,
    message,
    detail,
    type: problem.type,
    requestId: response.headers.get("x-request-id") ?? requestId,
  });
}

/** Extracts a display message from anything thrown. */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}
