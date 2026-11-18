<script setup lang="ts">
import { onMounted } from 'vue'
import { useConversationStore } from '@/stores/conversations'
import ConversationListItem from '@/components/chats/ConversationListItem.vue'
import LoadMoreConversations from '@/components/chats/LoadMoreConversations.vue'

const store = useConversationStore()

onMounted(store.loadFirstPageIfNeeded)
</script>

<template>
  <section aria-labelledby="conversation-list-heading">
    <div class="flex h-6 items-center px-2 pb-1 box-content">
      <h2
        id="conversation-list-heading"
        class="text-xs font-semibold tracking-wide text-base-content/50 uppercase"
      >
        Messages
      </h2>
    </div>
    <p v-if="store.error && !store.conversationsByRecentActivity.length" class="px-2 py-1 text-sm text-error">
      Couldn't load conversations.
    </p>
    <ul>
      <li v-for="conversation in store.conversationsByRecentActivity" :key="conversation.id">
        <ConversationListItem :conversation="conversation" />
      </li>
    </ul>
    <LoadMoreConversations />
  </section>
</template>
