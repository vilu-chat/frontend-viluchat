/** Seeded user from the auth stub's `GET /dev/users`. */
export interface DevUser {
  id: string
  name: string
  preferred_username: string
}

/** Token endpoint response (`POST /realms/{realm}/protocol/openid-connect/token`). No refresh token. */
export interface TokenResponse {
  access_token: string
  token_type: string
  /** Lifetime in seconds (5 minutes on the stub). */
  expires_in: number
}

/** What we keep about the logged-in user (persisted in sessionStorage). */
export interface AuthSession {
  user: DevUser
  accessToken: string
  /** Epoch milliseconds. */
  expiresAt: number
}

/** Why the user was sent back to the login screen (`?reason=` on `/login`). */
export type LogoutReason = 'expired' | 'account_deleted'
