<script setup lang="ts">
import { computed } from 'vue'
import { Users } from '@lucide/vue'
import type { ChatUser } from '@/types/chat'
import UserAvatar from '@/components/shared/UserAvatar.vue'

const props = defineProps<{
  /** Everyone except the current user; may be only a preview of the group. */
  otherMembers: ChatUser[]
  /** Defaults to `otherMembers.length`. */
  otherMemberCount?: number
}>()

const AVATARS_SHOWN = 2
const MAX_HIDDEN_COUNT_SHOWN = 99

const hiddenMemberCount = computed(() =>
  Math.max(0, (props.otherMemberCount ?? props.otherMembers.length) - AVATARS_SHOWN),
)
</script>

<!-- Parents set --avatar-ring to their own background so the rings look like cut-outs. -->
<template>
  <UserAvatar v-if="otherMembers.length === 1" :name="otherMembers[0]!.name" />

  <div v-else-if="otherMembers.length" class="relative size-10 shrink-0" aria-hidden="true">
    <!-- Positioned wrappers: UserAvatar's own `relative` would override an `absolute` passed to it. -->
    <span class="absolute top-0 left-0">
      <UserAvatar :name="otherMembers[0]!.name" size="sm" />
    </span>
    <span class="absolute right-0 bottom-0 rounded-full ring-2 ring-[var(--avatar-ring,var(--color-sidebar))]">
      <UserAvatar :name="otherMembers[1]!.name" size="sm" />
    </span>
    <span
      v-if="hiddenMemberCount"
      class="absolute bottom-0 left-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-base-content/25 px-1 text-[9px] leading-none font-semibold text-base-content ring-2 ring-[var(--avatar-ring,var(--color-sidebar))]"
    >
      +{{ Math.min(hiddenMemberCount, MAX_HIDDEN_COUNT_SHOWN) }}
    </span>
  </div>

  <!-- Members not loaded yet, or nobody else left in the group. -->
  <div
    v-else
    class="flex size-10 shrink-0 items-center justify-center rounded-full bg-base-content/15 text-base-content/70"
    aria-hidden="true"
  >
    <Users class="size-5" />
  </div>
</template>
