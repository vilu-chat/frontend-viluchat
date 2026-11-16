/**
 * Wire-format DTOs for user-service and message-service (OpenAPI v1).
 * Kept in snake_case exactly as sent over the wire; mapping to UI types happens in the stores.
 * Response fields are all `readOnly` in the specs and always present, so they're typed as required here.
 */

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

/** OpenAPI `Error` schema (error response body, both services). */
export interface ApiErrorBody {
  /** Error code (the HTTP status). */
  code?: number
  /** Error name, e.g. `Not Found`. */
  status?: string
  message?: string
  /** Validation details, typically keyed by field/location. */
  errors?: Record<string, unknown>
  /** Machine-readable reason, e.g. `account_deleted` (403 from `GET /users/me`). Not in the spec's schema. */
  error_code?: string
}

// ---------------------------------------------------------------------------
// user-service
// ---------------------------------------------------------------------------

/** Own profile (`GET /api/v1/users/me`; the row is created on the first call). */
export interface UserMe {
  id: string
  display_name: string
  bio: string | null
  status_text: string | null
  avatar_url: string | null
  locale: string | null
  timezone: string | null
  created_at: string
}

/** Public profile of another user. */
export interface User {
  id: string
  display_name: string
  bio: string | null
  status_text: string | null
  avatar_url: string | null
}

/** `PATCH /api/v1/users/me`: only the fields sent are changed. */
export interface UserUpdate {
  /** 1–64 chars. */
  display_name?: string
  /** ≤500 chars. */
  bio?: string | null
  /** ≤140 chars. */
  status_text?: string | null
  /** ≤10 chars. */
  locale?: string | null
  /** ≤64 chars. */
  timezone?: string | null
}

/** `POST /api/v1/users/lookup` body (1–100 ids). Responds with `User[]`; unknown/deleted users are omitted. */
export interface UserLookup {
  ids: string[]
}

// ---------------------------------------------------------------------------
// message-service
// ---------------------------------------------------------------------------

export type ConversationType = 'direct' | 'group'
export type MessageKind = 'text'

export interface Message {
  id: string
  conversation_id: string
  /** Monotonic per-conversation sequence number. */
  seq: number
  sender_id: string
  client_msg_id: string
  kind: MessageKind
  /** `null` once the message is deleted. */
  body: string | null
  reply_to_id: string | null
  created_at: string
  edited_at: string | null
  deleted_at: string | null
}

/** List entry from `GET /api/v1/conversations`. Has no members. */
export interface ConversationSummary {
  id: string
  type: ConversationType
  title: string | null
  last_seq: number
  unread_count: number
  last_message: Message | null
  updated_at: string
}

export interface ConversationPage {
  items: ConversationSummary[]
  next_cursor: string | null
}

export interface Member {
  user_id: string
  role: string
  joined_at: string
}

/** Full conversation from `GET /api/v1/conversations/{id}`. */
export interface Conversation {
  id: string
  type: ConversationType
  title: string | null
  created_by: string
  last_seq: number
  created_at: string
  updated_at: string
  members: Member[]
}

/** `POST /api/v1/conversations`: the caller becomes admin. */
export interface GroupCreate {
  /** 1–100 chars. */
  title: string
  /** 1–99 ids (the caller is added on top). */
  member_ids: string[]
}

/** `POST /api/v1/conversations/direct`: get-or-create. */
export interface DirectCreate {
  user_id: string
}

export interface MessagePage {
  items: Message[]
  has_more: boolean
}

export interface MessageCreate {
  client_msg_id: string
  /** Defaults to `text`. */
  kind?: MessageKind
  /** 1–4000 chars. */
  body: string
}

/** `PUT /api/v1/conversations/{id}/read`: only moves forward. */
export interface ReadUpdate {
  seq: number
}

export interface ReadPosition {
  last_read_seq: number
}
