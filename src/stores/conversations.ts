import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import * as messageApi from '@/services/messageService'
import { useUserStore } from '@/stores/users'
import type { Conversation as ApiConversation, ConversationSummary, Message } from '@/types/api'
import type { ChatUser, Conversation } from '@/types/chat'
import { ApiError } from '@/utils/http'

const PAGE_SIZE = 30

/** Summary-shaped view of a conversation we only know through its details (e.g. just created). */
function summaryFromDetails(c: ApiConversation): ConversationSummary {
  return {
    id: c.id,
    type: c.type,
    title: c.title,
    last_message: null,
    last_seq: c.last_seq,
    unread_count: 0,
    updated_at: c.updated_at,
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

  /** Bumped on every first-page load so a stale response can't overwrite a newer one. */
  let listGeneration = 0

  // ---------------------------------------------------------------------------
  // Mapping to the UI type
  // ---------------------------------------------------------------------------

  function toListItem(s: ConversationSummary): Conversation {
    const meId = users.me?.id
    const others = (details.value[s.id]?.members ?? []).filter((m) => m.user_id !== meId)
    const members: ChatUser[] = others.map((m) => ({ id: m.user_id, name: users.displayName(m.user_id) }))

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
    return detail ? toListItem(summaryFromDetails(detail)) : undefined
  }

  // ---------------------------------------------------------------------------
  // Loading
  // ---------------------------------------------------------------------------

  /**
   * Fills in what the list needs beyond the summaries: details of direct conversations (to find the
   * peer, since summaries carry no members) and the profiles of members and last-message senders.
   * Failures here are non-fatal: the list falls back to placeholder names.
   */
  async function hydrate(items: ConversationSummary[]): Promise<void> {
    // API gap: drop this step once ConversationSummary exposes members / peer_user_id.
    const directIds = items.filter((s) => s.type === 'direct' && !details.value[s.id]).map((s) => s.id)
    await Promise.allSettled(directIds.map(loadDetails))

    const userIds = new Set<string>()
    for (const s of items) {
      if (s.last_message) userIds.add(s.last_message.sender_id)
      for (const m of details.value[s.id]?.members ?? []) userIds.add(m.user_id)
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
      if (generation !== listGeneration) return
      summaries.value = Object.fromEntries(page.items.map((s) => [s.id, s]))
      nextCursor.value = page.next_cursor
      await hydrate(page.items)
    } catch (e) {
      if (generation === listGeneration) error.value = ApiError.from(e)
    } finally {
      if (generation === listGeneration) loading.value = false
    }
  }

  /** Appends the next page, if any. */
  async function fetchMore(): Promise<void> {
    if (!nextCursor.value || loading.value) return
    const generation = listGeneration
    loading.value = true
    error.value = null
    try {
      const page = await messageApi.listConversations({ limit: PAGE_SIZE, cursor: nextCursor.value })
      if (generation !== listGeneration) return
      for (const s of page.items) summaries.value[s.id] = s
      nextCursor.value = page.next_cursor
      await hydrate(page.items)
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
    summaries.value[conversation.id] ??= summaryFromDetails(conversation)
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
    summary.unread_count = 0
    try {
      await messageApi.markRead(id, summary.last_seq)
    } catch {
      // Restore unless something else (e.g. a newer read) already changed it.
      if (summary.unread_count === 0) summary.unread_count = previousUnread
    }
  }

  /** Keeps the summary in sync with a message we just sent or received. */
  function applyMessage(message: Message): void {
    const summary = summaries.value[message.conversation_id]
    if (!summary || message.seq < summary.last_seq) return
    summary.last_message = message
    summary.last_seq = message.seq
    if (message.created_at > summary.updated_at) summary.updated_at = message.created_at
  }

  return {
    summaries,
    details,
    nextCursor,
    loading,
    error,
    sortedConversations,
    getById,
    fetchConversations,
    fetchMore,
    fetchConversation,
    openDirect,
    createGroup,
    markAsRead,
    applyMessage,
  }
})
