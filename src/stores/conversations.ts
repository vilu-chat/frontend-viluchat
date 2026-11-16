import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { Conversation } from '@/types/chat'
import { mockConversations } from '@/mocks/conversations'

export const useConversationStore = defineStore('conversations', () => {
  const conversations = ref<Conversation[]>(mockConversations)

  /** Newest activity first. */
  const sortedConversations = computed(() =>
    [...conversations.value].sort((a, b) => b.lastMessage.sentAt.localeCompare(a.lastMessage.sentAt)),
  )

  function getById(id: string) {
    return conversations.value.find((c) => c.id === id)
  }

  function markAsRead(id: string) {
    const conversation = getById(id)
    if (conversation) conversation.unreadCount = 0
  }

  return { conversations, sortedConversations, getById, markAsRead }
})
