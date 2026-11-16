<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { listDevUsers, login } from '@/lib/auth'
import type { DevUser, LogoutReason } from '@/types/auth'
import UserAvatar from '@/components/shared/UserAvatar.vue'

const route = useRoute()
const router = useRouter()

const users = ref<DevUser[]>([])
const loading = ref(false)
const loadError = ref<string | null>(null)
const loggingInAs = ref<string | null>(null)
const loginError = ref<string | null>(null)

const reasonMessages: Record<LogoutReason, string> = {
  expired: 'Your session ended. Pick a user to log in again.',
  account_deleted: 'That account has been deleted.',
}
const reason = computed(() => reasonMessages[route.query.reason as LogoutReason] ?? null)

/** Only same-app paths, so `?redirect=` can't send the user to another site. */
const redirectTo = computed(() => {
  const target = route.query.redirect
  return typeof target === 'string' && target.startsWith('/') && !target.startsWith('//') ? target : '/'
})

async function loadUsers() {
  loading.value = true
  loadError.value = null
  try {
    users.value = await listDevUsers()
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

async function pick(user: DevUser) {
  if (loggingInAs.value) return
  loggingInAs.value = user.id
  loginError.value = null
  try {
    await login(user)
    await router.replace(redirectTo.value)
  } catch (e) {
    loginError.value = e instanceof Error ? e.message : String(e)
  } finally {
    loggingInAs.value = null
  }
}

onMounted(loadUsers)
</script>

<template>
  <main class="flex min-h-screen items-center justify-center bg-background p-4 text-base-content">
    <section
      aria-labelledby="login-heading"
      class="w-full max-w-sm rounded-xl border border-border bg-sidebar p-6 shadow-lg"
    >
      <h1 id="login-heading" class="text-lg font-semibold">Log in to Viluchat</h1>
      <p class="mt-1 text-sm text-base-content/60">Development login: pick a seeded user.</p>

      <p v-if="reason" role="status" class="mt-4 rounded-lg bg-warning/15 px-3 py-2 text-sm text-warning">
        {{ reason }}
      </p>
      <p v-if="loginError" role="alert" class="mt-4 rounded-lg bg-error/15 px-3 py-2 text-sm text-error">
        {{ loginError }}
      </p>

      <div class="mt-4">
        <p v-if="loading" class="py-6 text-center text-sm text-base-content/60">Loading users…</p>

        <div v-else-if="loadError" role="alert" class="py-4 text-center text-sm">
          <p class="text-error">{{ loadError }}</p>
          <button type="button" class="btn mt-3 btn-sm" @click="loadUsers">Try again</button>
        </div>

        <p v-else-if="!users.length" class="py-6 text-center text-sm text-base-content/60">No users available.</p>

        <ul v-else class="-mx-2 max-h-96 overflow-y-auto">
          <li v-for="user in users" :key="user.id">
            <button
              type="button"
              class="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-base-content/5 disabled:opacity-60"
              :disabled="loggingInAs !== null"
              :aria-busy="loggingInAs === user.id"
              @click="pick(user)"
            >
              <UserAvatar :name="user.name" />
              <span class="min-w-0 flex-1">
                <span class="block truncate font-semibold">{{ user.name }}</span>
                <span class="block truncate text-sm text-base-content/60">@{{ user.preferred_username }}</span>
              </span>
              <span v-if="loggingInAs === user.id" class="loading loading-sm loading-spinner" aria-hidden="true" />
            </button>
          </li>
        </ul>
      </div>
    </section>
  </main>
</template>
