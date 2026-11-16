<script setup lang="ts">
import type { ChatUser } from '@/types/chat'
import UserAvatar from '@/components/shared/UserAvatar.vue'

defineProps<{ members: ChatUser[] }>()
</script>

<template>
  <div class="grid size-10 shrink-0 grid-cols-2 gap-0.5" aria-hidden="true">
    <UserAvatar v-for="member in members.slice(0, 4)" :key="member.id" :name="member.name" size="xs" />
  </div>
</template>
