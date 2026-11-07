/**
 * Thin fetch wrapper: timeouts, JSON, and the backend's error envelope
 * ({ error: { code, message, requestId } } — backend/schemas/errors.py).
 */

import { API_BASE_URL } from "./config";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;

  constructor(message: string, status: number, code: string, requestId?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }

  /** What to tell a person, not a developer. */
  get friendly(): string {
    if (this.status === 0) return "Couldn't reach the API. Is the backend running?";
    if (this.status === 401) return "Your session has expired. Sign in again.";
    if (this.status === 403) return "Your role doesn't allow this action.";
    if (this.status === 404) return "That doesn't exist (or it isn't available on this backend yet).";
    if (this.status === 409) return "Someone changed this in the meantime. Refresh and try again.";
    if (this.status === 429) return "Too many requests — give it a few seconds.";
    if (this.status >= 500) return "The server hit an error. Try again shortly.";
    return this.message;
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  timeoutMs?: number;
  base?: string;
}

interface ErrorEnvelope {
  error?: { code?: string; message?: string; requestId?: string };
}

export async function http<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { body, timeoutMs = 10_000, base = API_BASE_URL, headers, ...rest } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      ...rest,
      signal: rest.signal ?? controller.signal,
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    clearTimeout(timer);
    const aborted = err instanceof DOMException && err.name === "AbortError";
    throw new ApiError(aborted ? "Request timed out" : "Network error", 0, aborted ? "TIMEOUT" : "NETWORK");
  }
  clearTimeout(timer);

  if (!res.ok) {
    let envelope: ErrorEnvelope = {};
    try {
      envelope = (await res.json()) as ErrorEnvelope;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(
      envelope.error?.message ?? `Request failed (${res.status})`,
      res.status,
      envelope.error?.code ?? "HTTP_ERROR",
      envelope.error?.requestId ?? res.headers.get("x-request-id") ?? undefined
    );
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (err instanceof Error) return new ApiError(err.message, -1, "CLIENT");
  return new ApiError(String(err), -1, "CLIENT");
}
