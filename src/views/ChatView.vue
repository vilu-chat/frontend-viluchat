<script setup lang="ts">
import { computed, watch } from 'vue'
import { useConversationStore } from '@/stores/conversations'

const props = defineProps<{ id?: string }>()

const store = useConversationStore()
const conversation = computed(() => (props.id ? store.getById(props.id) : undefined))

watch(
  () => props.id,
  (id) => {
    if (id) store.markAsRead(id)
  },
  { immediate: true },
)
</script>

<template>
  <div class="flex flex-1 items-center justify-center text-base-content/50">
    <template v-if="!id">Select a conversation</template>
    <template v-else-if="conversation">{{ conversation.name }}</template>
    <template v-else>Conversation not found</template>
  </div>
</template>
