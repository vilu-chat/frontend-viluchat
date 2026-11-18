import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import * as messageApi from '@/services/messageService'
import { useUserStore } from '@/stores/users'
import type { Conversation as ApiConversation, ConversationSummary, Message } from '@/types/api'
import type { ConversationMember, ConversationListItem } from '@/types/chat'
import { ApiError } from '@/utils/http'

const PAGE_SIZE = 30
const MEMBER_PREVIEW_SIZE = 4

/** For conversations we only know through their detailsById, e.g. one we just created. */
function summaryFromDetails(conversation: ApiConversation, currentUserId: string | undefined): ConversationSummary {
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
      .filter((id) => id !== currentUserId)
      .slice(0, MEMBER_PREVIEW_SIZE),
  }
}

export const useConversationStore = defineStore('conversations', () => {
  const users = useUserStore()

  const summariesById = ref<Record<string, ConversationSummary>>({})
  /** Full conversations (with members), loaded on demand. */
  const detailsById = ref<Record<string, ApiConversation>>({})
  const nextCursor = ref<string | null>(null)
  const loading = ref(false)
  const error = ref<ApiError | null>(null)
  const firstPageLoaded = ref(false)
  let latestListFetchId = 0

  // ---------------------------------------------------------------------------
  // Mapping to the UI type
  // ---------------------------------------------------------------------------

  function toConversationListItem(summary: ConversationSummary): ConversationListItem {
    const currentUserId = users.currentUser?.id
    const detail = detailsById.value[summary.id]
    const otherMemberIds = detail
      ? detail.members.map((member) => member.user_id).filter((id) => id !== currentUserId)
      : summary.member_preview_ids
    const members: ConversationMember[] = otherMemberIds.map((id) => ({ id, name: users.displayName(id) }))

    const fallbackName = summary.type === 'direct' ? (members[0]?.name ?? 'Direct message') : 'Group'
    const last = summary.last_message

    return {
      id: summary.id,
      type: summary.type,
      name: summary.title || fallbackName,
      members,
      lastMessage: last
        ? {
            text: last.deleted_at ? 'Message deleted' : (last.body ?? ''),
            sentAt: last.created_at,
            senderName: users.displayName(last.sender_id),
            fromMe: last.sender_id === currentUserId,
          }
        : undefined,
      unreadCount: summary.unread_count,
      memberCount: detail ? detail.members.length : summary.member_count,
    }
  }

  const conversationsByRecentActivity = computed(() =>
    Object.values(summariesById.value)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .map(toConversationListItem),
  )

  function getById(id: string): ConversationListItem | undefined {
    const summary = summariesById.value[id]
    if (summary) return toConversationListItem(summary)
    const detail = detailsById.value[id]
    return detail ? toConversationListItem(summaryFromDetails(detail, users.currentUser?.id)) : undefined
  }

  // ---------------------------------------------------------------------------
  // Loading
  // ---------------------------------------------------------------------------

  /** The list then shows the summary's member preview until the chat is opened again. */
  function dropDetailsWithOutdatedMembers(items: ConversationSummary[]): void {
    for (const summary of items) {
      const detail = detailsById.value[summary.id]
      if (detail && detail.members.length !== summary.member_count) delete detailsById.value[summary.id]
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

  async function fetchAndStoreDetails(id: string): Promise<ApiConversation> {
    const conversation = await messageApi.getConversation(id)
    detailsById.value[id] = conversation
    return conversation
  }

  /** Loads the first page, replacing whatever was loaded before. Errors land in `error`. */
  async function fetchFirstPage(): Promise<void> {
    const thisFetchId = ++latestListFetchId
    loading.value = true
    error.value = null
    try {
      const page = await messageApi.listConversations({ limit: PAGE_SIZE })
      const items = page.items
      if (thisFetchId !== latestListFetchId) return
      summariesById.value = Object.fromEntries(items.map((summary) => [summary.id, summary]))
      nextCursor.value = page.next_cursor
      firstPageLoaded.value = true
      dropDetailsWithOutdatedMembers(items)
      await loadUsersShownIn(items)
    } catch (e) {
      if (thisFetchId === latestListFetchId) error.value = ApiError.from(e)
    } finally {
      if (thisFetchId === latestListFetchId) loading.value = false
    }
  }

  /** Unlike `fetchFirstPage`, keeps pages already scrolled in (e.g. when switching sidebar tabs). */
  function loadFirstPageIfNeeded(): Promise<void> {
    if (firstPageLoaded.value || loading.value) return Promise.resolve()
    return fetchFirstPage()
  }

  async function fetchNextPage(): Promise<void> {
    if (!nextCursor.value || loading.value) return
    const thisFetchId = latestListFetchId
    loading.value = true
    error.value = null
    try {
      const page = await messageApi.listConversations({ limit: PAGE_SIZE, cursor: nextCursor.value })
      const items = page.items
      if (thisFetchId !== latestListFetchId) return
      for (const summary of items) summariesById.value[summary.id] = summary
      nextCursor.value = page.next_cursor
      dropDetailsWithOutdatedMembers(items)
      await loadUsersShownIn(items)
    } catch (e) {
      if (thisFetchId === latestListFetchId) error.value = ApiError.from(e)
    } finally {
      if (thisFetchId === latestListFetchId) loading.value = false
    }
  }

  /** Loads one conversation with its members (e.g. when opened via URL and not in the list yet). */
  async function fetchConversationWithMembers(id: string): Promise<ApiConversation> {
    const conversation = await fetchAndStoreDetails(id)
    await users.ensureUsers(conversation.members.map((member) => member.user_id)).catch(() => {})
    return conversation
  }

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  function storeCreatedConversation(conversation: ApiConversation) {
    detailsById.value[conversation.id] = conversation
    summariesById.value[conversation.id] ??= summaryFromDetails(conversation, users.currentUser?.id)
  }

  async function openDirect(userId: string): Promise<ApiConversation> {
    const conversation = await messageApi.getOrCreateDirect(userId)
    storeCreatedConversation(conversation)
    await users.ensureUsers(conversation.members.map((member) => member.user_id)).catch(() => {})
    return conversation
  }

  async function createGroup(title: string, memberIds: string[]): Promise<ApiConversation> {
    const conversation = await messageApi.createGroup({ title, member_ids: memberIds })
    storeCreatedConversation(conversation)
    await users.ensureUsers(conversation.members.map((member) => member.user_id)).catch(() => {})
    return conversation
  }

  /** Optimistically clears the unread badge, then persists the read position. */
  async function markAsRead(id: string): Promise<void> {
    const summary = summariesById.value[id]
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
    const summary = summariesById.value[message.conversation_id]
    if (!summary || message.seq < summary.last_seq) return
    summary.last_message = message
    summary.last_seq = message.seq
    // The server marks the sender's own message as read.
    if (message.sender_id === users.currentUser?.id) summary.last_read_seq = Math.max(summary.last_read_seq, message.seq)
    if (message.created_at > summary.updated_at) summary.updated_at = message.created_at
  }

  return {
    summariesById,
    detailsById,
    nextCursor,
    loading,
    firstPageLoaded,
    error,
    conversationsByRecentActivity,
    getById,
    fetchFirstPage,
    loadFirstPageIfNeeded,
    fetchNextPage,
    fetchConversationWithMembers,
    openDirect,
    createGroup,
    markAsRead,
    applyMessage,
  }
})
