<script setup lang="ts">
import { onMounted } from 'vue'
import { useConversationStore } from '@/stores/conversations'
import ConversationListItem from '@/components/chats/ConversationListItem.vue'

const store = useConversationStore()

onMounted(store.fetchConversations)
</script>

<template>
  <section aria-labelledby="conversation-list-heading">
    <h2
      id="conversation-list-heading"
      class="px-2 pb-1 text-xs font-semibold tracking-wide text-base-content/50 uppercase"
    >
      Messages
    </h2>
    <p v-if="store.error && !store.sortedConversations.length" class="px-2 py-1 text-sm text-error">
      Couldn't load conversations.
    </p>
    <ul>
      <li v-for="conversation in store.sortedConversations" :key="conversation.id">
        <ConversationListItem :conversation="conversation" />
      </li>
    </ul>
  </section>
</template>
