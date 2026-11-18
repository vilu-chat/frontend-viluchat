import type { Message, MessageKind } from '@/types/api'
import type { ApiError } from '@/utils/http'

export interface ConversationMember {
  id: string
  name: string
  online?: boolean
}

export interface MessagePreview {
  text: string
  sentAt: string
  senderName: string
  fromMe: boolean
}

export interface ConversationListItem {
  id: string
  type: 'direct' | 'group'
  name: string
  members: ConversationMember[]
  /** Absent for conversations without messages yet. */
  lastMessage?: MessagePreview
  unreadCount: number
  /** Active members, the current user included. */
  memberCount: number
}

/** A message we sent that the server hasn't confirmed yet (or that failed). */
export interface OutgoingMessage {
  client_msg_id: string
  conversation_id: string
  kind: MessageKind
  body: string
  created_at: string
  status: 'pending' | 'failed'
  error: ApiError | null
}

/** Per-conversation state in the message store. */
export interface ConversationMessages {
  /** Confirmed messages, ordered by `seq`, unique by `id`. */
  messages: Message[]
  /** Optimistic messages, shown after `messages`. */
  outgoing: OutgoingMessage[]
  hasMoreOlder: boolean
  loading: boolean
  loaded: boolean
  error: ApiError | null
}
