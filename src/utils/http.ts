import { getConfig } from '@/lib/config'
import type { ApiErrorBody } from '@/types/api'

/** Thrown for every failed request. `status` is 0 for network errors / aborts. */
export class ApiError extends Error {
  readonly status: number
  /** `code` from the error body (the HTTP status as reported by the service). */
  readonly httpStatusFromBody: number | undefined
  /** `status` from the error body, e.g. `Unprocessable Entity`. */
  readonly httpStatusText: string | undefined
  /** Validation details from the error body (422), keyed by field/location. */
  readonly errors: Record<string, unknown>
  /** `error_code` from the error body, e.g. `account_deleted`. */
  readonly errorCode: string | undefined

  constructor(status: number, message: string, body?: ApiErrorBody, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'ApiError'
    this.status = status
    this.httpStatusFromBody = body?.code
    this.httpStatusText = body?.status
    this.errors = body?.errors ?? {}
    this.errorCode = body?.error_code
  }

  /** Normalizes anything thrown into an `ApiError`. */
  static from(e: unknown): ApiError {
    return e instanceof ApiError ? e : new ApiError(0, e instanceof Error ? e.message : String(e), undefined, { cause: e })
  }

  get isAbort(): boolean {
    return this.status === 0 && this.cause instanceof DOMException && this.cause.name === 'AbortError'
  }
}

type TokenProvider = () => string | null | Promise<string | null>
type TokenRefresher = () => Promise<string | null>
type ApiErrorListener = (error: ApiError) => void

let tokenProvider: TokenProvider | null = null
let tokenRefresher: TokenRefresher | null = null
let errorListener: ApiErrorListener | null = null

/** Auth plugs in here: return the current access token (or null when logged out). */
export function setAuthTokenProvider(fn: TokenProvider | null): void {
  tokenProvider = fn
}

/** On a 401 the request is retried once with the token this returns (skipped when it returns null). */
export function setTokenRefresher(fn: TokenRefresher | null): void {
  tokenRefresher = fn
}

/**
 * Called for every non-2xx response (after the 401 retry), before the error is thrown to the caller.
 * Used by auth to log out on a 401 that persists or on a deleted account.
 */
export function onApiError(fn: ApiErrorListener | null): void {
  errorListener = fn
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
export type QueryValue = string | number | boolean | null | undefined
export type Query = Record<string, QueryValue | QueryValue[]>

export interface RequestOptions {
  query?: Query
  body?: unknown
  signal?: AbortSignal
}

function buildUrl(path: string, query?: Query): string {
  const base = getConfig().apiBaseUrl.replace(/\/+$/, '')
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`
  if (!query) return url

  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    for (const v of Array.isArray(value) ? value : [value]) {
      if (v !== undefined && v !== null) params.append(key, String(v))
    }
  }
  const qs = params.toString()
  return qs ? `${url}?${qs}` : url
}

async function parseErrorBody(res: Response): Promise<ApiErrorBody | undefined> {
  const text = await res.text().catch(() => '')
  if (!text) return undefined
  try {
    const parsed: unknown = JSON.parse(text)
    return parsed && typeof parsed === 'object' ? (parsed as ApiErrorBody) : undefined
  } catch {
    return undefined
  }
}

async function sendRequest(method: HttpMethod, path: string, options: RequestOptions, token: string | null) {
  const { query, body, signal } = options
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  try {
    return await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  } catch (cause) {
    const aborted = cause instanceof DOMException && cause.name === 'AbortError'
    throw new ApiError(0, aborted ? 'Request aborted' : 'Network error', undefined, { cause })
  }
}

export async function request<T>(method: HttpMethod, path: string, options: RequestOptions = {}): Promise<T> {
  let res = await sendRequest(method, path, options, tokenProvider ? await tokenProvider() : null)

  // Expired or revoked token: get a fresh one and retry once.
  if (res.status === 401 && tokenRefresher) {
    const fresh = await tokenRefresher()
    if (fresh) res = await sendRequest(method, path, options, fresh)
  }

  if (!res.ok) {
    const errorBody = await parseErrorBody(res)
    const error = new ApiError(
      res.status,
      errorBody?.message ?? `${method} ${path} failed with ${res.status} ${res.statusText}`.trim(),
      errorBody,
    )
    errorListener?.(error)
    throw error
  }

  if (res.status === 204) return undefined as T
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

export const http = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'body'>) => request<T>('GET', path, options),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>) =>
    request<T>('POST', path, { ...options, body }),
  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>) =>
    request<T>('PUT', path, { ...options, body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>) =>
    request<T>('PATCH', path, { ...options, body }),
  delete: <T = void>(path: string, options?: Omit<RequestOptions, 'body'>) => request<T>('DELETE', path, options),
}
