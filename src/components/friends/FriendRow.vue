<script setup lang="ts">
import type { User } from '@/types/api'
import UserAvatar from '@/components/shared/UserAvatar.vue'

defineProps<{ user: User }>()
</script>

<template>
  <div class="flex items-center gap-3">
    <UserAvatar :name="user.display_name" />
    <span class="min-w-0 flex-1">
      <span class="block truncate font-semibold">{{ user.display_name }}</span>
      <span v-if="user.username" class="block truncate text-sm text-base-content/50">@{{ user.username }}</span>
    </span>
    <slot />
  </div>
</template>
