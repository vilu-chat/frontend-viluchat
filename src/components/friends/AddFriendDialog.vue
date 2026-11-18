<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { X } from '@lucide/vue'
import { useAddFriendDialog } from '@/composables/useAddFriendDialog'
import * as userApi from '@/services/userService'
import { useRelationStore } from '@/stores/relations'
import type { User } from '@/types/api'
import { ApiError } from '@/utils/http'
import FriendRow from '@/components/friends/FriendRow.vue'
import SearchBar from '@/components/shared/SearchBar.vue'

// API limits (`GET /users/search`).
const MIN_QUERY_LENGTH = 3
const MAX_QUERY_LENGTH = 64
const DEBOUNCE_MS = 300

const relations = useRelationStore()
const { isOpen, close } = useAddFriendDialog()

const dialog = ref<HTMLDialogElement | null>(null)
const query = ref('')
const results = ref<User[]>([])
const searching = ref(false)
const searchError = ref<string | null>(null)
const busyId = ref<string | null>(null)
const actionError = ref<string | null>(null)
const searchedFor = ref('')

const trimmed = computed(() => query.value.trim().toLowerCase().replace(/^@/, ''))
const tooShort = computed(() => trimmed.value.length < MIN_QUERY_LENGTH)

let timer: ReturnType<typeof setTimeout> | undefined
let controller: AbortController | undefined

async function runSearch(q: string) {
  controller?.abort()
  controller = new AbortController()
  searching.value = true
  searchError.value = null
  try {
    results.value = await userApi.searchUsers(q, 20, controller.signal)
    searchedFor.value = q
  } catch (e) {
    const err = ApiError.from(e)
    if (err.isAbort) return
    searchError.value = err.message || "Couldn't search."
  }
  searching.value = false
}

function reset() {
  clearTimeout(timer)
  controller?.abort()
  query.value = ''
  results.value = []
  searchedFor.value = ''
  searching.value = false
  searchError.value = null
  actionError.value = null
}

watch(trimmed, (q) => {
  clearTimeout(timer)
  actionError.value = null
  if (q.length < MIN_QUERY_LENGTH || q.length > MAX_QUERY_LENGTH) {
    controller?.abort()
    results.value = []
    searchedFor.value = ''
    searching.value = false
    return
  }
  timer = setTimeout(() => runSearch(q), DEBOUNCE_MS)
})

async function add(user: User) {
  busyId.value = user.id
  actionError.value = null
  try {
    if (relations.statusOf(user.id) === 'request-received') await relations.acceptRequest(user.id)
    else await relations.sendRequest(user.id)
  } catch (e) {
    actionError.value = ApiError.from(e).message || 'Something went wrong.'
  } finally {
    busyId.value = null
  }
}

watch(
  isOpen,
  (shouldBeOpen) => {
    const el = dialog.value
    if (!el) return
    if (shouldBeOpen && !el.open) {
      reset()
      el.showModal()
    } else if (!shouldBeOpen && el.open) {
      el.close()
    }
  },
  { flush: 'post' },
)

onBeforeUnmount(() => {
  clearTimeout(timer)
  controller?.abort()
  close()
})
</script>

<template>
  <dialog ref="dialog" class="modal" aria-labelledby="add-friend-title" @close="close">
    <div class="modal-box flex max-h-[80vh] flex-col gap-4 bg-sidebar p-5">
      <div class="flex items-center justify-between">
        <h2 id="add-friend-title" class="text-lg font-semibold">Add friend</h2>
        <button
          type="button"
          class="flex size-8 items-center justify-center rounded-full text-base-content/60 hover:bg-hover"
          aria-label="Close"
          @click="close"
        >
          <X class="size-4" aria-hidden="true" />
        </button>
      </div>

      <div class="flex flex-col gap-1.5">
        <p class="text-xs font-semibold tracking-wide text-base-content/50 uppercase">Username</p>
        <SearchBar v-model="query" placeholder="Search by username (e.g. anna)" />
      </div>

      <div class="-mx-2 min-h-32 flex-1 overflow-y-auto">
        <p v-if="actionError" class="px-2 pb-2 text-sm text-error" role="alert">{{ actionError }}</p>
        <p v-if="!query.trim()" class="px-2 py-2 text-sm text-base-content/50">
          Search by username. Display names are not searched.
        </p>
        <p v-else-if="tooShort" class="px-2 py-2 text-sm text-base-content/50">
          Type at least {{ MIN_QUERY_LENGTH }} characters.
        </p>
        <p v-else-if="searchError" class="px-2 py-2 text-sm text-error">{{ searchError }}</p>
        <p v-else-if="searching" class="px-2 py-2 text-sm text-base-content/50">Searching…</p>
        <p v-else-if="searchedFor === trimmed && !results.length" class="px-2 py-2 text-sm text-base-content/50">
          No one found.
        </p>
        <ul v-if="!tooShort">
          <li v-for="user in results" :key="user.id" class="rounded-lg px-2 py-2 hover:bg-hover-subtle">
            <FriendRow :user="user">
              <span v-if="relations.statusOf(user.id) === 'friend'" class="text-sm text-base-content/50">Friends</span>
              <span v-else-if="relations.statusOf(user.id) === 'request-sent'" class="text-sm text-base-content/50">
                Request sent
              </span>
              <button v-else type="button" class="ui-btn ui-btn-primary" :disabled="busyId === user.id" @click="add(user)">
                {{ relations.statusOf(user.id) === 'request-received' ? 'Accept' : 'Add' }}
              </button>
            </FriendRow>
          </li>
        </ul>
      </div>

      <div class="flex justify-end">
        <button type="button" class="ui-btn ui-btn-ghost" @click="close">Close</button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button type="submit" aria-label="Close">close</button>
    </form>
  </dialog>
</template>
