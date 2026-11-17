import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import * as messageApi from '@/services/messageService'
import { useUserStore } from '@/stores/users'
import type { Conversation as ApiConversation, ConversationSummary, Message } from '@/types/api'
import type { ChatUser, Conversation } from '@/types/chat'
import { ApiError } from '@/utils/http'

const PAGE_SIZE = 30
const MEMBER_PREVIEW_SIZE = 4

/** For conversations we only know through their details, e.g. one we just created. */
function summaryFromDetails(conversation: ApiConversation, myId: string | undefined): ConversationSummary {
  return {
    id: conversation.id,
    type: conversation.type,
    title: conversation.title,
    last_message: null,
    last_seq: conversation.last_seq,
    unread_count: 0,
    updated_at: conversation.updated_at,
    last_read_seq: conversation.last_seq,
    member_count: conversation.members.length,
    member_preview_ids: conversation.members
      .map((member) => member.user_id)
      .filter((id) => id !== myId)
      .slice(0, MEMBER_PREVIEW_SIZE),
  }
}

export const useConversationStore = defineStore('conversations', () => {
  const users = useUserStore()

  const summaries = ref<Record<string, ConversationSummary>>({})
  /** Full conversations (with members), loaded on demand. */
  const details = ref<Record<string, ApiConversation>>({})
  const nextCursor = ref<string | null>(null)
  const loading = ref(false)
  const error = ref<ApiError | null>(null)
  const firstPageLoaded = ref(false)

  /** Bumped on every first-page load so a stale response can't overwrite a newer one. */
  let listGeneration = 0

  // ---------------------------------------------------------------------------
  // Mapping to the UI type
  // ---------------------------------------------------------------------------

  function toListItem(s: ConversationSummary): Conversation {
    const meId = users.me?.id
    const detail = details.value[s.id]
    const otherMemberIds = detail
      ? detail.members.map((m) => m.user_id).filter((id) => id !== meId)
      : s.member_preview_ids
    const members: ChatUser[] = otherMemberIds.map((id) => ({ id, name: users.displayName(id) }))

    const fallbackName = s.type === 'direct' ? (members[0]?.name ?? 'Direct message') : 'Group'
    const last = s.last_message

    return {
      id: s.id,
      type: s.type,
      name: s.title || fallbackName,
      members,
      lastMessage: last
        ? {
            text: last.deleted_at ? 'Message deleted' : (last.body ?? ''),
            sentAt: last.created_at,
            senderName: users.displayName(last.sender_id),
            fromMe: last.sender_id === meId,
          }
        : undefined,
      unreadCount: s.unread_count,
      memberCount: detail ? detail.members.length : s.member_count,
    }
  }

  /** Newest activity first. */
  const sortedConversations = computed(() =>
    Object.values(summaries.value)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .map(toListItem),
  )

  function getById(id: string): Conversation | undefined {
    const summary = summaries.value[id]
    if (summary) return toListItem(summary)
    const detail = details.value[id]
    return detail ? toListItem(summaryFromDetails(detail, users.me?.id)) : undefined
  }

  // ---------------------------------------------------------------------------
  // Loading
  // ---------------------------------------------------------------------------

  /** The list then shows the summary's member preview until the chat is opened again. */
  function dropDetailsWithOutdatedMembers(items: ConversationSummary[]): void {
    for (const summary of items) {
      const detail = details.value[summary.id]
      if (detail && detail.members.length !== summary.member_count) delete details.value[summary.id]
    }
  }

  /** Failures are ignored: the list falls back to placeholder names. */
  async function loadUsersShownIn(items: ConversationSummary[]): Promise<void> {
    const userIds = new Set<string>()
    for (const summary of items) {
      if (summary.last_message) userIds.add(summary.last_message.sender_id)
      for (const id of summary.member_preview_ids) userIds.add(id)
    }
    await users.ensureUsers(userIds).catch(() => {})
  }

  async function loadDetails(id: string): Promise<ApiConversation> {
    const conversation = await messageApi.getConversation(id)
    details.value[id] = conversation
    return conversation
  }

  /** Loads the first page, replacing whatever was loaded before. Errors land in `error`. */
  async function fetchConversations(): Promise<void> {
    const generation = ++listGeneration
    loading.value = true
    error.value = null
    try {
      const page = await messageApi.listConversations({ limit: PAGE_SIZE })
      const items = page.items
      if (generation !== listGeneration) return
      summaries.value = Object.fromEntries(items.map((s) => [s.id, s]))
      nextCursor.value = page.next_cursor
      firstPageLoaded.value = true
      dropDetailsWithOutdatedMembers(items)
      await loadUsersShownIn(items)
    } catch (e) {
      if (generation === listGeneration) error.value = ApiError.from(e)
    } finally {
      if (generation === listGeneration) loading.value = false
    }
  }

  /** Unlike `fetchConversations`, keeps pages already scrolled in (e.g. when switching sidebar tabs). */
  function loadConversationsOnce(): Promise<void> {
    if (firstPageLoaded.value || loading.value) return Promise.resolve()
    return fetchConversations()
  }

  async function fetchNextPage(): Promise<void> {
    if (!nextCursor.value || loading.value) return
    const generation = listGeneration
    loading.value = true
    error.value = null
    try {
      const page = await messageApi.listConversations({ limit: PAGE_SIZE, cursor: nextCursor.value })
      const items = page.items
      if (generation !== listGeneration) return
      for (const s of items) summaries.value[s.id] = s
      nextCursor.value = page.next_cursor
      dropDetailsWithOutdatedMembers(items)
      await loadUsersShownIn(items)
    } catch (e) {
      if (generation === listGeneration) error.value = ApiError.from(e)
    } finally {
      if (generation === listGeneration) loading.value = false
    }
  }

  /** Loads one conversation with its members (e.g. when opened via URL and not in the list yet). */
  async function fetchConversation(id: string): Promise<ApiConversation> {
    const conversation = await loadDetails(id)
    await users.ensureUsers(conversation.members.map((m) => m.user_id)).catch(() => {})
    return conversation
  }

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  function adopt(conversation: ApiConversation) {
    details.value[conversation.id] = conversation
    summaries.value[conversation.id] ??= summaryFromDetails(conversation, users.me?.id)
  }

  async function openDirect(userId: string): Promise<ApiConversation> {
    const conversation = await messageApi.getOrCreateDirect(userId)
    adopt(conversation)
    await users.ensureUsers(conversation.members.map((m) => m.user_id)).catch(() => {})
    return conversation
  }

  async function createGroup(title: string, memberIds: string[]): Promise<ApiConversation> {
    const conversation = await messageApi.createGroup({ title, member_ids: memberIds })
    adopt(conversation)
    await users.ensureUsers(conversation.members.map((m) => m.user_id)).catch(() => {})
    return conversation
  }

  /** Optimistically clears the unread badge, then persists the read position. */
  async function markAsRead(id: string): Promise<void> {
    const summary = summaries.value[id]
    if (!summary || summary.unread_count === 0 || summary.last_seq <= 0) return

    const previousUnread = summary.unread_count
    const previousReadSeq = summary.last_read_seq
    summary.unread_count = 0
    summary.last_read_seq = summary.last_seq
    try {
      await messageApi.markRead(id, summary.last_seq)
    } catch {
      // Restore unless something else (e.g. a newer read) already changed it.
      if (summary.unread_count === 0) {
        summary.unread_count = previousUnread
        summary.last_read_seq = previousReadSeq
      }
    }
  }

  /** Keeps the summary in sync with a message we just sent or received. */
  function applyMessage(message: Message): void {
    const summary = summaries.value[message.conversation_id]
    if (!summary || message.seq < summary.last_seq) return
    summary.last_message = message
    summary.last_seq = message.seq
    // The server marks the sender's own message as read.
    if (message.sender_id === users.me?.id) summary.last_read_seq = Math.max(summary.last_read_seq, message.seq)
    if (message.created_at > summary.updated_at) summary.updated_at = message.created_at
  }

  return {
    summaries,
    details,
    nextCursor,
    loading,
    firstPageLoaded,
    error,
    sortedConversations,
    getById,
    fetchConversations,
    loadConversationsOnce,
    fetchNextPage,
    fetchConversation,
    openDirect,
    createGroup,
    markAsRead,
    applyMessage,
  }
})
