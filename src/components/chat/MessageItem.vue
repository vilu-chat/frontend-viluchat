<script setup lang="ts">
import { computed } from 'vue'
import { useUserStore } from '@/stores/users'
import { formatMessageTime, formatTimeOfDay } from '@/utils/formatChatTime'
import UserAvatar from '@/components/shared/UserAvatar.vue'

const props = defineProps<{
  body: string | null
  senderId: string
  createdAt: string
  editedAt?: string | null
  deletedAt?: string | null
  showHeader: boolean
  status?: 'pending' | 'failed'
}>()

const emit = defineEmits<{ retry: []; discard: [] }>()

const users = useUserStore()
const senderName = computed(() => users.displayName(props.senderId))
</script>

<template>
  <div
    class="group flex gap-4 px-4 py-0.5 hover:bg-hover-subtle"
    :class="showHeader ? 'mt-4' : ''"
  >
    <div class="w-10 shrink-0">
      <UserAvatar v-if="showHeader" :name="senderName" />
      <time
        v-else
        :datetime="createdAt"
        :title="formatMessageTime(createdAt)"
        class="invisible block pt-1 text-right text-[10px] leading-5 text-base-content/40 group-hover:visible"
      >
        {{ formatTimeOfDay(createdAt) }}
      </time>
    </div>

    <div class="min-w-0 flex-1">
      <div v-if="showHeader" class="flex items-baseline gap-2">
        <span class="font-semibold">{{ senderName }}</span>
        <time :datetime="createdAt" class="text-xs text-base-content/50">{{ formatMessageTime(createdAt) }}</time>
      </div>

      <p v-if="deletedAt" class="italic text-base-content/40">Message deleted</p>
      <p
        v-else
        class="leading-relaxed break-words whitespace-pre-wrap"
        :class="{ 'opacity-50': status === 'pending', 'text-error': status === 'failed' }"
      >{{ body }}<span v-if="editedAt" class="ml-1 text-[10px] text-base-content/40">(edited)</span></p>

      <div v-if="status === 'failed'" class="flex gap-3 text-xs text-error">
        <span>Couldn't send.</span>
        <button type="button" class="link" @click="emit('retry')">Retry</button>
        <button type="button" class="link" @click="emit('discard')">Discard</button>
      </div>
    </div>
  </div>
</template>
