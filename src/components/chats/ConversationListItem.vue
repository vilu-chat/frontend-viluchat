<script setup lang="ts">
import { computed } from 'vue'
import type { Conversation } from '@/types/chat'
import { formatChatTime } from '@/utils/formatChatTime'
import GroupAvatar from '@/components/shared/GroupAvatar.vue'
import UserAvatar from '@/components/shared/UserAvatar.vue'

const props = defineProps<{ conversation: Conversation }>()

const preview = computed(() => {
  const { lastMessage, type } = props.conversation
  if (!lastMessage) return 'No messages yet'
  if (lastMessage.fromMe) return `You: ${lastMessage.text}`
  if (type === 'group') return `${lastMessage.senderName.split(' ')[0]}: ${lastMessage.text}`
  return lastMessage.text
})
</script>

<template>
  <RouterLink
    v-slot="{ href, navigate, isExactActive }"
    :to="{ name: 'chats', params: { id: conversation.id } }"
    custom
  >
    <a
      :href="href"
      :aria-current="isExactActive ? 'page' : undefined"
      class="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors"
      :class="isExactActive ? 'bg-primary text-primary-content [--avatar-ring:var(--color-primary)]' : 'hover:bg-hover-subtle'"
      @click="navigate"
    >
      <GroupAvatar
        v-if="conversation.type === 'group'"
        :other-members="conversation.members"
        :other-member-count="conversation.memberCount - 1"
      />
      <UserAvatar v-else :name="conversation.name" :online="conversation.members[0]?.online" />

      <div class="min-w-0 flex-1">
        <div class="flex items-baseline gap-2">
          <span class="flex-1 truncate font-semibold">{{ conversation.name }}</span>
          <time
            v-if="conversation.lastMessage"
            :datetime="conversation.lastMessage.sentAt"
            class="shrink-0 text-xs"
            :class="isExactActive ? 'text-primary-content/80' : 'text-base-content/60'"
          >
            {{ formatChatTime(conversation.lastMessage.sentAt) }}
          </time>
        </div>
        <div class="flex items-center gap-2">
          <span
            class="flex-1 truncate text-sm"
            :class="isExactActive ? 'text-primary-content/80' : 'text-base-content/60'"
          >
            {{ preview }}
          </span>
          <span
            v-if="conversation.unreadCount"
            class="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full px-1 text-[10px] font-semibold"
            :class="isExactActive ? 'bg-primary-content text-primary' : 'bg-primary text-primary-content'"
          >
            <span aria-hidden="true">{{ conversation.unreadCount > 9 ? '9+' : conversation.unreadCount }}</span>
            <span class="sr-only">{{ conversation.unreadCount }} unread</span>
          </span>
        </div>
      </div>
    </a>
  </RouterLink>
</template>
