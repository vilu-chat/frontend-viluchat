<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { Plus } from '@lucide/vue'
import { useConversationStore } from '@/stores/conversations'
import { useNewGroupDialog } from '@/composables/useNewGroupDialog'
import ConversationListItem from '@/components/chats/ConversationListItem.vue'
import LoadMoreConversations from '@/components/chats/LoadMoreConversations.vue'

const store = useConversationStore()
const newGroupDialog = useNewGroupDialog()
const groups = computed(() => store.sortedConversations.filter((c) => c.type === 'group'))
// Groups can sit on later pages behind newer direct chats, so wait until every page is in.
const allPagesLoaded = computed(() => store.firstPageLoaded && !store.nextCursor && !store.loading)
const noGroupsAtAll = computed(() => allPagesLoaded.value && !groups.value.length)

onMounted(store.loadConversationsOnce)
</script>

<template>
  <section aria-labelledby="group-list-heading">
    <div class="flex items-center justify-between px-2 pb-1">
      <h2 id="group-list-heading" class="text-xs font-semibold tracking-wide text-base-content/50 uppercase">
        Groups
      </h2>
      <button
        type="button"
        class="flex size-6 items-center justify-center rounded-md text-base-content/60 hover:bg-hover hover:text-base-content"
        aria-label="New group"
        title="New group"
        @click="newGroupDialog.open"
      >
        <Plus class="size-4" aria-hidden="true" />
      </button>
    </div>
    <p v-if="store.error && !store.sortedConversations.length" class="px-2 py-1 text-sm text-error">
      Couldn't load groups.
    </p>
    <p v-else-if="noGroupsAtAll" class="px-2 py-1 text-sm text-base-content/50">No groups yet.</p>
    <ul>
      <li v-for="group in groups" :key="group.id">
        <ConversationListItem :conversation="group" />
      </li>
    </ul>
    <LoadMoreConversations />
  </section>
</template>
