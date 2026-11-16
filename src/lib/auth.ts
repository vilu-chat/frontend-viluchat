/**
 * All login handling lives here; the rest of the app only uses `login()`, `logout()`, `getToken()`
 * (plus `currentSession` / `isLoggedIn()` for the UI and router guard).
 *
 * Today this talks to the dev auth stub ("pick a user"); switching to Keycloak should only touch this file.
 * The stub mimics Keycloak's URL layout: `{keycloak.url}/realms/{realm}/protocol/openid-connect/token`.
 */
import { readonly, ref } from 'vue'
import { getConfig } from '@/lib/config'
import type { AuthSession, DevUser, LogoutReason, TokenResponse } from '@/types/auth'
import { onApiError, setAuthTokenProvider, setTokenRefresher } from '@/utils/http'

const STORAGE_KEY = 'viluchat.auth'
/** Renew when less than this is left (tokens live 5 min, there is no refresh token). */
const RENEW_MARGIN_MS = 30_000

const session = ref<AuthSession | null>(loadSession())
/** In-flight token request, shared so concurrent callers don't each fetch a token. */
let renewing: Promise<string | null> | null = null

/** The logged-in user, reactive and read-only. */
export const currentSession = readonly(session)

export function isLoggedIn(): boolean {
  return session.value !== null
}

// ---------------------------------------------------------------------------
// Stub endpoints
// ---------------------------------------------------------------------------

function authBase(): string {
  return getConfig().keycloak.url.replace(/\/+$/, '')
}

function tokenUrl(): string {
  const { realm } = getConfig().keycloak
  return `${authBase()}/realms/${encodeURIComponent(realm)}/protocol/openid-connect/token`
}

/** Seeded users for the login picker. */
export async function listDevUsers(signal?: AbortSignal): Promise<DevUser[]> {
  const res = await fetch(`${authBase()}/dev/users`, { headers: { Accept: 'application/json' }, signal })
  if (!res.ok) throw new Error(`Couldn't load users (${res.status})`)
  return (await res.json()) as DevUser[]
}

async function requestToken(username: string): Promise<Pick<AuthSession, 'accessToken' | 'expiresAt'>> {
  const res = await fetch(tokenUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({ username }),
  })
  if (!res.ok) throw new Error(`Login failed (${res.status})`)
  const data = (await res.json()) as TokenResponse
  return { accessToken: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 }
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

function loadSession(): AuthSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as AuthSession) : null
  } catch {
    return null
  }
}

function saveSession(value: AuthSession | null): void {
  session.value = value
  if (value) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  else sessionStorage.removeItem(STORAGE_KEY)
}

export async function login(user: DevUser): Promise<void> {
  const token = await requestToken(user.preferred_username)
  saveSession({ user, ...token })
}

/**
 * Clears the session and does a full page load of `/login`, which also drops every store's cached data
 * from the previous user.
 */
export function logout(reason?: LogoutReason): void {
  saveSession(null)
  renewing = null
  const query = reason ? `?reason=${reason}` : ''
  window.location.assign(`/login${query}`)
}

/** Fetches a fresh token for the current user. Resolves to `null` if there is no session or it failed. */
function renewToken(): Promise<string | null> {
  const current = session.value
  if (!current) return Promise.resolve(null)

  renewing ??= requestToken(current.user.preferred_username)
    .then((token) => {
      // Ignore the result if the user logged out or switched in the meantime.
      if (session.value?.user.id !== current.user.id) return null
      saveSession({ ...session.value, ...token })
      return token.accessToken
    })
    .catch(() => null)
    .finally(() => {
      renewing = null
    })
  return renewing
}

/** Current access token, renewed first when it is about to expire. `null` when logged out. */
export async function getToken(): Promise<string | null> {
  const current = session.value
  if (!current) return null
  if (current.expiresAt - Date.now() > RENEW_MARGIN_MS) return current.accessToken

  const renewed = await renewToken()
  // If renewal failed, the old token is still worth a try as long as it hasn't expired.
  return renewed ?? (current.expiresAt > Date.now() ? current.accessToken : null)
}

// ---------------------------------------------------------------------------
// Wiring into the HTTP layer
// ---------------------------------------------------------------------------

/** Call once at startup (before mounting). */
export function setupAuth(): void {
  setAuthTokenProvider(getToken)
  // On a 401 the HTTP layer asks for a fresh token and retries once.
  setTokenRefresher(renewToken)
  onApiError((error) => {
    if (!isLoggedIn()) return
    // Still 401 after the retry: the session is no good anymore.
    if (error.status === 401) logout('expired')
    else if (error.status === 403 && error.errorCode === 'account_deleted') logout('account_deleted')
  })
}
