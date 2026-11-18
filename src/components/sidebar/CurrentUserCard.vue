<script setup lang="ts">
import { computed, ref } from 'vue'
import { EllipsisVertical, LogOut, Trash2, UserPen } from '@lucide/vue'
import { currentSession, logout } from '@/lib/auth'
import { useUserStore } from '@/stores/users'
import UserAvatar from '@/components/shared/UserAvatar.vue'
import ProfileDialog from '@/components/profile/ProfileDialog.vue'
import DeleteAccountDialog from '@/components/profile/DeleteAccountDialog.vue'

const users = useUserStore()

// Profile from `GET /users/me` once loaded; the name from the login until then.
const name = computed(() => users.me?.display_name ?? currentSession.value?.user.name ?? '')
const statusText = computed(() => users.me?.status_text ?? `@${currentSession.value?.user.preferred_username ?? ''}`)

const profileOpen = ref(false)
const deleteOpen = ref(false)

/** daisyUI dropdowns stay open while focused, so drop focus after picking an entry. */
function openDialog(which: 'profile' | 'delete') {
  ;(document.activeElement as HTMLElement | null)?.blur()
  if (which === 'profile') profileOpen.value = true
  else deleteOpen.value = true
}
</script>

<template>
  <div v-if="currentSession" class="flex items-center gap-3 border-t border-border pt-3">
    <UserAvatar :name="name" />
    <div class="min-w-0 flex-1">
      <div class="truncate font-semibold">{{ name }}</div>
      <div class="truncate text-sm text-base-content/60">{{ statusText }}</div>
    </div>
    <div class="dropdown dropdown-top dropdown-end">
      <button
        type="button"
        tabindex="0"
        class="flex size-8 items-center justify-center rounded-md text-base-content/60 transition-colors hover:bg-hover hover:text-base-content"
        aria-label="Account menu"
        title="Account menu"
      >
        <EllipsisVertical class="size-4" aria-hidden="true" />
      </button>
      <ul tabindex="0" class="dropdown-content z-10 mb-2 w-52 rounded-lg border border-border bg-sidebar p-1 shadow-lg">
        <li>
          <button type="button" class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-hover" @click="openDialog('profile')">
            <UserPen class="size-4" aria-hidden="true" /> Edit profile
          </button>
        </li>
        <li>
          <button type="button" class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-hover" @click="logout()">
            <LogOut class="size-4" aria-hidden="true" /> Log out
          </button>
        </li>
        <li>
          <button type="button" class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-hover text-error" @click="openDialog('delete')">
            <Trash2 class="size-4" aria-hidden="true" /> Delete account
          </button>
        </li>
      </ul>
    </div>
    <ProfileDialog v-model:open="profileOpen" />
    <DeleteAccountDialog v-model:open="deleteOpen" />
  </div>
</template>
