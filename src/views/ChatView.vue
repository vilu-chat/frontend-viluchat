<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useConversationStore } from '@/stores/conversations'
import { useMessageStore } from '@/stores/messages'
import GroupAvatar from '@/components/shared/GroupAvatar.vue'
import UserAvatar from '@/components/shared/UserAvatar.vue'
import MessageComposer from '@/components/chat/MessageComposer.vue'
import MessageList from '@/components/chat/MessageList.vue'

const props = defineProps<{ id?: string }>()

const conversationStore = useConversationStore()
const messageStore = useMessageStore()
const conversation = computed(() => (props.id ? conversationStore.getById(props.id) : undefined))
const fetching = ref(false)

// Opened via URL before (or outside) the list's first page: load it directly.
watch(
  () => props.id,
  async (id) => {
    if (!id) return
    const cachedConversation = conversationStore.getById(id)
    if (cachedConversation) {
      // Group members can change, so refresh them in the background.
      if (cachedConversation.type === 'group') conversationStore.fetchConversation(id).catch(() => {})
      return
    }
    fetching.value = true
    try {
      await conversationStore.fetchConversation(id)
    } catch {
      // Falls through to "Conversation not found".
    } finally {
      if (props.id === id) fetching.value = false
    }
  },
  { immediate: true },
)

watch(
  () => conversation.value?.id,
  (id) => {
    if (id && !messageStore.get(id)?.loaded) messageStore.loadLatest(id)
  },
  { immediate: true },
)

// Captured once per opening, before marking as read clears the unread count, so the
// "New messages" line stays put while the chat is open.
const firstUnreadSeq = ref<number | null>(null)
let firstUnreadSeqCapturedFor: string | null = null

watch(
  () => props.id,
  () => {
    firstUnreadSeq.value = null
    firstUnreadSeqCapturedFor = null
  },
)

// Must be declared after the reset above, so the reset runs first when the id changes.
watch(
  () => [props.id, conversation.value?.unreadCount] as const,
  ([id, unreadCount]) => {
    if (!id || unreadCount === undefined) return
    if (firstUnreadSeqCapturedFor !== id) {
      firstUnreadSeqCapturedFor = id
      const lastReadSeq = conversationStore.summaries[id]?.last_read_seq
      firstUnreadSeq.value = unreadCount && lastReadSeq !== undefined ? lastReadSeq + 1 : null
    }
    if (unreadCount) conversationStore.markAsRead(id)
  },
  { immediate: true },
)

const draft = computed({
  get: () => (props.id ? (messageStore.drafts[props.id] ?? '') : ''),
  set: (text: string) => {
    if (props.id) messageStore.setDraft(props.id, text)
  },
})

/** "4 members · Emma, Oskar, Sara and you"; only the count until the full member list is loaded. */
const groupSubtitle = computed(() => {
  const group = conversation.value
  if (group?.type !== 'group') return null
  const memberCountText = `${group.memberCount} ${group.memberCount === 1 ? 'member' : 'members'}`
  if (!conversationStore.details[group.id]) return memberCountText
  const firstNames = group.members.map((member) => member.name.split(' ')[0])
  return `${memberCountText} · ${firstNames.length ? `${firstNames.join(', ')} and you` : 'Just you'}`
})

function sendMessage(body: string) {
  if (props.id) messageStore.send(props.id, body)
}
</script>

<template>
  <div v-if="id && conversation" class="flex min-h-0 flex-1 flex-col bg-chat">
    <header class="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4 [--avatar-ring:var(--color-chat)]">
      <GroupAvatar
        v-if="conversation.type === 'group'"
        :other-members="conversation.members"
        :other-member-count="conversation.memberCount - 1"
      />
      <UserAvatar v-else :name="conversation.name" :online="conversation.members[0]?.online" />
      <div class="min-w-0">
        <h1 class="truncate font-semibold leading-tight">{{ conversation.name }}</h1>
        <p v-if="groupSubtitle" class="truncate text-xs text-base-content/50">{{ groupSubtitle }}</p>
      </div>
    </header>

    <MessageList :key="id" :conversation-id="id" :first-unread-seq="firstUnreadSeq" />
    <MessageComposer :key="id" v-model="draft" :placeholder="`Message ${conversation.name}`" @send="sendMessage" />
  </div>

  <div v-else class="flex flex-1 items-center justify-center text-base-content/50">
    <template v-if="!id">Select a conversation</template>
    <template v-else-if="fetching || conversationStore.loading">Loading…</template>
    <template v-else>Conversation not found</template>
  </div>
</template>
