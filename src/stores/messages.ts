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
  const stateByConversationId = ref<Record<string, ConversationMessages>>({})
  /** Unsent composer text per conversation. Not persisted. */
  const drafts = ref<Record<string, string>>({})

  function setDraft(conversationId: string, text: string): void {
    if (text) drafts.value[conversationId] = text
    else delete drafts.value[conversationId]
  }

  function getOrCreateState(conversationId: string): ConversationMessages {
    if (!stateByConversationId.value[conversationId]) stateByConversationId.value[conversationId] = emptyState()
    return stateByConversationId.value[conversationId]
  }

  function findState(conversationId: string): ConversationMessages | undefined {
    return stateByConversationId.value[conversationId]
  }

  function mergeMessages(conversationId: string, incoming: Message[]): void {
    if (!incoming.length) return
    const state = getOrCreateState(conversationId)
    const merged = new Map(state.messages.map((message) => [message.id, message]))
    for (const message of incoming) merged.set(message.id, message)
    state.messages = [...merged.values()].sort((a, b) => a.seq - b.seq)

    const confirmed = new Set(incoming.map((message) => message.client_msg_id))
    state.outgoing = state.outgoing.filter((o) => !confirmed.has(o.client_msg_id))

    conversations.applyMessage(state.messages[state.messages.length - 1]!)
    users.ensureUsers(incoming.map((message) => message.sender_id)).catch(() => {})
  }

  async function runWithLoadingState(conversationId: string, fn: (state: ConversationMessages) => Promise<void>) {
    const state = getOrCreateState(conversationId)
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

  function loadLatest(conversationId: string): Promise<void> {
    return runWithLoadingState(conversationId, async (state) => {
      const page = await messageApi.listMessages(conversationId, { limit: PAGE_SIZE })
      mergeMessages(conversationId, page.items)
      state.hasMoreOlder = page.has_more
      state.loaded = true
    })
  }

  async function loadOlder(conversationId: string): Promise<void> {
    const state = getOrCreateState(conversationId)
    const oldest = state.messages[0]
    if (!oldest) return loadLatest(conversationId)
    if (!state.hasMoreOlder) return

    return runWithLoadingState(conversationId, async () => {
      const page = await messageApi.listMessages(conversationId, { before_seq: oldest.seq, limit: PAGE_SIZE })
      mergeMessages(conversationId, page.items)
      state.hasMoreOlder = page.has_more
    })
  }

  async function loadMissedMessages(conversationId: string): Promise<void> {
    const state = getOrCreateState(conversationId)
    if (!state.messages.length) return loadLatest(conversationId)

    return runWithLoadingState(conversationId, async () => {
      let afterSeq = state.messages[state.messages.length - 1]!.seq
      for (;;) {
        const page = await messageApi.listMessages(conversationId, { after_seq: afterSeq, limit: PAGE_SIZE })
        mergeMessages(conversationId, page.items)
        const newest = page.items.reduce((max, message) => Math.max(max, message.seq), afterSeq)
        if (!page.has_more || newest <= afterSeq) break
        afterSeq = newest
      }
    })
  }

  async function sendOutgoing(conversationId: string, clientMsgId: string): Promise<Message | null> {
    const findOutgoing = () => getOrCreateState(conversationId).outgoing.find((outgoingMessage) => outgoingMessage.client_msg_id === clientMsgId)
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
      mergeMessages(conversationId, [message])
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

  function send(conversationId: string, body: string): Promise<Message | null> {
    getOrCreateState(conversationId).outgoing.push({
      client_msg_id: crypto.randomUUID(),
      conversation_id: conversationId,
      kind: 'text',
      body,
      created_at: new Date().toISOString(),
      status: 'pending',
      error: null,
    })
    const clientMsgId = getOrCreateState(conversationId).outgoing.at(-1)!.client_msg_id
    return sendOutgoing(conversationId, clientMsgId)
  }

  async function retry(conversationId: string, clientMsgId: string): Promise<Message | null> {
    const outgoing = findState(conversationId)?.outgoing.find((outgoingMessage) => outgoingMessage.client_msg_id === clientMsgId)
    if (outgoing?.status !== 'failed') return null
    return sendOutgoing(conversationId, clientMsgId)
  }

  function discard(conversationId: string, clientMsgId: string): void {
    const state = getOrCreateState(conversationId)
    state.outgoing = state.outgoing.filter((outgoingMessage) => outgoingMessage.client_msg_id !== clientMsgId)
  }

  return { stateByConversationId, drafts, setDraft, findState, getOrCreateState, loadLatest, loadOlder, loadMissedMessages, send, retry, discard }
})
