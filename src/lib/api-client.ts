/**
 * Typed fetch wrapper for the event feed API.
 * All endpoints return { data, meta, errors } envelope.
 */

import type { ApiMeta, ApiError } from "@/types/api";

export type ApiResult<T> =
  | { ok: true; data: T; meta: ApiMeta }
  | { ok: false; errors: ApiError[] };

async function request<T>(
  path: string,
  init?: RequestInit
): Promise<ApiResult<T>> {
  const res = await fetch(path, init);

  let json: Record<string, unknown>;
  try {
    json = await res.json();
  } catch {
    return {
      ok: false,
      errors: [{ code: "PARSE_ERROR", message: `Non-JSON response (HTTP ${res.status})`, retryable: true }],
    };
  }

  if (json.errors && (json.data === null || json.data === undefined)) {
    return { ok: false, errors: json.errors as ApiError[] };
  }

  return { ok: true, data: json.data as T, meta: (json.meta ?? {}) as ApiMeta };
}

export function apiGet<T>(
  path: string,
  params?: Record<string, string>
): Promise<ApiResult<T>> {
  const url = params
    ? `${path}?${new URLSearchParams(params).toString()}`
    : path;
  return request<T>(url);
}

export function apiPost<T>(
  path: string,
  body: unknown
): Promise<ApiResult<T>> {
  return request<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function apiPut<T>(
  path: string,
  body: unknown
): Promise<ApiResult<T>> {
  return request<T>(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function apiDelete<T>(path: string): Promise<ApiResult<T>> {
  return request<T>(path, { method: "DELETE" });
}
