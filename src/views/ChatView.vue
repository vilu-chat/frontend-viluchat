<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useConversationStore } from '@/stores/conversations'

const props = defineProps<{ id?: string }>()

const store = useConversationStore()
const conversation = computed(() => (props.id ? store.getById(props.id) : undefined))
const fetching = ref(false)

// Opened via URL before (or outside) the list's first page: load it directly.
watch(
  () => props.id,
  async (id) => {
    if (!id || store.getById(id)) return
    fetching.value = true
    try {
      await store.fetchConversation(id)
    } catch {
      // Falls through to "Conversation not found".
    } finally {
      if (props.id === id) fetching.value = false
    }
  },
  { immediate: true },
)

// Re-runs when the summary arrives or new unread messages come in while the chat is open.
watch(
  () => [props.id, conversation.value?.unreadCount] as const,
  ([id, unread]) => {
    if (id && unread) store.markAsRead(id)
  },
  { immediate: true },
)
</script>

<template>
  <div class="flex flex-1 items-center justify-center text-base-content/50">
    <template v-if="!id">Select a conversation</template>
    <template v-else-if="conversation">{{ conversation.name }}</template>
    <template v-else-if="fetching || store.loading">Loading…</template>
    <template v-else>Conversation not found</template>
  </div>
</template>
