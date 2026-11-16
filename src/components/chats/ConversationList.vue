<script setup lang="ts">
import { useConversationStore } from '@/stores/conversations'
import ConversationListItem from '@/components/chats/ConversationListItem.vue'

const store = useConversationStore()
</script>

<template>
  <section aria-labelledby="conversation-list-heading">
    <h2
      id="conversation-list-heading"
      class="px-2 pb-1 text-xs font-semibold tracking-wide text-base-content/50 uppercase"
    >
      Messages
    </h2>
    <ul>
      <li v-for="conversation in store.sortedConversations" :key="conversation.id">
        <ConversationListItem :conversation="conversation" />
      </li>
    </ul>
  </section>
</template>
