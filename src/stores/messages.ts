import { ref } from 'vue'
import { defineStore } from 'pinia'
import * as messageApi from '@/services/messageService'
import { useConversationStore } from '@/stores/conversations'
import { useUserStore } from '@/stores/users'
import type { Message } from '@/types/api'
import type { ConversationMessages } from '@/types/chat'
import { ApiError } from '@/utils/http'

const PAGE_SIZE = 50

function emptyState(): ConversationMessages {
  return { messages: [], outgoing: [], hasMoreOlder: false, loading: false, loaded: false, error: null }
}

export const useMessageStore = defineStore('messages', () => {
  const conversations = useConversationStore()
  const users = useUserStore()
  const byConversation = ref<Record<string, ConversationMessages>>({})
  /** Unsent composer text per conversation. Not persisted. */
  const drafts = ref<Record<string, string>>({})

  function setDraft(conversationId: string, text: string): void {
    if (text) drafts.value[conversationId] = text
    else delete drafts.value[conversationId]
  }

  /** Per-conversation state, created on first use. Returns the reactive proxy, so mutations are tracked. */
  function stateFor(conversationId: string): ConversationMessages {
    if (!byConversation.value[conversationId]) byConversation.value[conversationId] = emptyState()
    return byConversation.value[conversationId]
  }

  /** Read-only accessor for templates/computeds (doesn't create state as a side effect). */
  function get(conversationId: string): ConversationMessages | undefined {
    return byConversation.value[conversationId]
  }

  /** Merges messages in (deduped by `id`, sorted by `seq`) and drops matching optimistic entries. */
  function upsert(conversationId: string, incoming: Message[]): void {
    if (!incoming.length) return
    const state = stateFor(conversationId)
    const merged = new Map(state.messages.map((m) => [m.id, m]))
    for (const m of incoming) merged.set(m.id, m)
    state.messages = [...merged.values()].sort((a, b) => a.seq - b.seq)

    const confirmed = new Set(incoming.map((m) => m.client_msg_id))
    state.outgoing = state.outgoing.filter((o) => !confirmed.has(o.client_msg_id))

    conversations.applyMessage(state.messages[state.messages.length - 1]!)
    users.ensureUsers(incoming.map((m) => m.sender_id)).catch(() => {})
  }

  async function withLoading(conversationId: string, fn: (state: ConversationMessages) => Promise<void>) {
    const state = stateFor(conversationId)
    if (state.loading) return
    state.loading = true
    state.error = null
    try {
      await fn(state)
    } catch (e) {
      state.error = ApiError.from(e)
    } finally {
      state.loading = false
    }
  }

  /** Loads the newest page. */
  function loadLatest(conversationId: string): Promise<void> {
    return withLoading(conversationId, async (state) => {
      const page = await messageApi.listMessages(conversationId, { limit: PAGE_SIZE })
      upsert(conversationId, page.items)
      state.hasMoreOlder = page.has_more
      state.loaded = true
    })
  }

  /** Loads the page before the oldest loaded message. */
  async function loadOlder(conversationId: string): Promise<void> {
    const state = stateFor(conversationId)
    const oldest = state.messages[0]
    if (!oldest) return loadLatest(conversationId)
    if (!state.hasMoreOlder) return

    return withLoading(conversationId, async (s) => {
      const page = await messageApi.listMessages(conversationId, { before_seq: oldest.seq, limit: PAGE_SIZE })
      upsert(conversationId, page.items)
      s.hasMoreOlder = page.has_more
    })
  }

  /** Fetches everything after the newest loaded message (e.g. after a websocket reconnect). */
  async function sync(conversationId: string): Promise<void> {
    const state = stateFor(conversationId)
    if (!state.messages.length) return loadLatest(conversationId)

    return withLoading(conversationId, async (s) => {
      let afterSeq = s.messages[s.messages.length - 1]!.seq
      for (;;) {
        const page = await messageApi.listMessages(conversationId, { after_seq: afterSeq, limit: PAGE_SIZE })
        upsert(conversationId, page.items)
        const newest = page.items.reduce((max, m) => Math.max(max, m.seq), afterSeq)
        if (!page.has_more || newest <= afterSeq) break
        afterSeq = newest
      }
    })
  }

  async function deliver(conversationId: string, clientMsgId: string): Promise<Message | null> {
    const findOutgoing = () => stateFor(conversationId).outgoing.find((o) => o.client_msg_id === clientMsgId)
    const outgoing = findOutgoing()
    if (!outgoing) return null

    outgoing.status = 'pending'
    outgoing.error = null
    try {
      const message = await messageApi.sendMessage(conversationId, {
        client_msg_id: outgoing.client_msg_id,
        kind: outgoing.kind,
        body: outgoing.body,
      })
      upsert(conversationId, [message])
      return message
    } catch (e) {
      const current = findOutgoing()
      if (current) {
        current.status = 'failed'
        current.error = ApiError.from(e)
      }
      return null
    }
  }

  /**
   * Sends a text message with an optimistic pending entry. Resolves to the confirmed message,
   * or `null` if it failed (the entry then stays in `outgoing` with `status: 'failed'`).
   */
  function send(conversationId: string, body: string): Promise<Message | null> {
    stateFor(conversationId).outgoing.push({
      client_msg_id: crypto.randomUUID(),
      conversation_id: conversationId,
      kind: 'text',
      body,
      created_at: new Date().toISOString(),
      status: 'pending',
      error: null,
    })
    const clientMsgId = stateFor(conversationId).outgoing.at(-1)!.client_msg_id
    return deliver(conversationId, clientMsgId)
  }

  /** Re-sends a failed message with the same `client_msg_id` (the endpoint is idempotent). */
  async function retry(conversationId: string, clientMsgId: string): Promise<Message | null> {
    const outgoing = get(conversationId)?.outgoing.find((o) => o.client_msg_id === clientMsgId)
    if (outgoing?.status !== 'failed') return null
    return deliver(conversationId, clientMsgId)
  }

  /** Drops a failed message from the outgoing list. */
  function discard(conversationId: string, clientMsgId: string): void {
    const state = stateFor(conversationId)
    state.outgoing = state.outgoing.filter((o) => o.client_msg_id !== clientMsgId)
  }

  return { byConversation, drafts, setDraft, get, stateFor, loadLatest, loadOlder, sync, send, retry, discard }
})
