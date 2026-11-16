import { http } from '@/utils/http'
import type {
  Conversation,
  ConversationPage,
  DirectCreate,
  GroupCreate,
  Message,
  MessageCreate,
  MessagePage,
  ReadPosition,
  ReadUpdate,
} from '@/types/api'

// Paths are relative to `apiBaseUrl` (`/api`), so `/v1/...` hits `/api/v1/...`.
const enc = encodeURIComponent

export interface ListConversationsParams {
  limit?: number
  cursor?: string | null
}

/** Either page forward from `after_seq` or backward from `before_seq` (latest page when neither is set). */
export type ListMessagesParams = { limit?: number } & (
  | { after_seq?: number; before_seq?: never }
  | { before_seq?: number; after_seq?: never }
)

export function listConversations(params: ListConversationsParams = {}, signal?: AbortSignal) {
  return http.get<ConversationPage>('/v1/conversations', {
    query: { limit: params.limit, cursor: params.cursor ?? undefined },
    signal,
  })
}

export function getConversation(id: string, signal?: AbortSignal) {
  return http.get<Conversation>(`/v1/conversations/${enc(id)}`, { signal })
}

/** The caller becomes the group's admin. */
export function createGroup(body: GroupCreate, signal?: AbortSignal) {
  return http.post<Conversation>('/v1/conversations', body, { signal })
}

/** Idempotent: returns the existing direct conversation with `userId` if there is one. */
export function getOrCreateDirect(userId: string, signal?: AbortSignal) {
  return http.post<Conversation>('/v1/conversations/direct', { user_id: userId } satisfies DirectCreate, { signal })
}

export function listMessages(conversationId: string, params: ListMessagesParams = {}, signal?: AbortSignal) {
  return http.get<MessagePage>(`/v1/conversations/${enc(conversationId)}/messages`, {
    query: { limit: params.limit, after_seq: params.after_seq, before_seq: params.before_seq },
    signal,
  })
}

/** Idempotent on `client_msg_id` (201 when created, 200 when it already existed), so retrying is safe. */
export function sendMessage(conversationId: string, body: MessageCreate, signal?: AbortSignal) {
  return http.post<Message>(`/v1/conversations/${enc(conversationId)}/messages`, body, { signal })
}

/** The server only moves the read position forward. */
export function markRead(conversationId: string, seq: number, signal?: AbortSignal) {
  return http.put<ReadPosition>(
    `/v1/conversations/${enc(conversationId)}/read`,
    { seq } satisfies ReadUpdate,
    { signal },
  )
}
