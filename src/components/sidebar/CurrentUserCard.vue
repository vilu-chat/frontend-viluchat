<script setup lang="ts">
import { computed } from 'vue'
import { LogOut } from '@lucide/vue'
import { currentSession, logout } from '@/lib/auth'
import { useUserStore } from '@/stores/users'
import UserAvatar from '@/components/shared/UserAvatar.vue'

const users = useUserStore()

// Profile from `GET /users/me` once loaded; the name from the login until then.
const name = computed(() => users.me?.display_name ?? currentSession.value?.user.name ?? '')
const statusText = computed(() => users.me?.status_text ?? `@${currentSession.value?.user.preferred_username ?? ''}`)
</script>

<template>
  <div v-if="currentSession" class="flex items-center gap-3 border-t bg-/25 pt-3">
    <UserAvatar :name="name" />
    <div class="min-w-0 flex-1">
      <div class="truncate font-semibold">{{ name }}</div>
      <div class="truncate text-sm text-base-content/60">{{ statusText }}</div>
    </div>
    <button
      type="button"
      class="btn btn-square btn-ghost btn-sm"
      aria-label="Log out"
      title="Log out"
      @click="logout()"
    >
      <LogOut class="size-4" aria-hidden="true" />
    </button>
  </div>
</template>
