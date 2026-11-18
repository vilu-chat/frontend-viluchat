<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Check, X } from '@lucide/vue'
import { useConversationStore } from '@/stores/conversations'
import { useRelationStore } from '@/stores/relations'
import { useNewGroupDialog } from '@/composables/useNewGroupDialog'
import { ApiError } from '@/utils/http'
import SearchBar from '@/components/shared/SearchBar.vue'
import UserAvatar from '@/components/shared/UserAvatar.vue'

// API limits (`GroupCreate`). Members excludes the creator.
const MAX_GROUP_NAME_LENGTH = 100
const MAX_MEMBERS = 99

const router = useRouter()
const conversationStore = useConversationStore()
const relationStore = useRelationStore()
const { isOpen, close } = useNewGroupDialog()

const dialog = ref<HTMLDialogElement | null>(null)
const groupName = ref('')
const searchQuery = ref('')
const selectedUserIds = ref<Set<string>>(new Set())

const creating = ref(false)
const createError = ref<string | null>(null)

const matchingPeople = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  return relationStore.friendsByName
    .map((relation) => relation.user)
    .filter(
      (person) =>
        !query ||
        person.display_name.toLowerCase().includes(query) ||
        (person.username ?? '').toLowerCase().includes(query),
    )
})

const selectedCount = computed(() => selectedUserIds.value.size)
const tooManyMembers = computed(() => selectedCount.value > MAX_MEMBERS)

const whyCreateIsDisabled = computed(() => {
  if (tooManyMembers.value) {
    return `Too many members: ${selectedCount.value}/${MAX_MEMBERS}. Remove ${selectedCount.value - MAX_MEMBERS}.`
  }
  if (!groupName.value.trim()) return 'Give the group a name.'
  if (selectedCount.value === 0) return 'Pick at least one member.'
  return null
})

const canCreate = computed(() => !whyCreateIsDisabled.value && !creating.value)

function resetForm() {
  groupName.value = ''
  searchQuery.value = ''
  selectedUserIds.value = new Set()
  createError.value = null
}

function toggleSelected(userId: string) {
  const next = new Set(selectedUserIds.value)
  if (!next.delete(userId)) next.add(userId)
  selectedUserIds.value = next
}

function preventEscapeWhileCreating(event: Event) {
  if (creating.value) event.preventDefault()
}

async function createGroup() {
  if (!canCreate.value) return
  creating.value = true
  createError.value = null
  try {
    const group = await conversationStore.createGroup(
      groupName.value.trim(),
      [...selectedUserIds.value].filter((id) => relationStore.friendIds.has(id)),
    )
    // Closed some other way meanwhile (e.g. navigated away): don't yank the user to the chat.
    if (!isOpen.value) return
    close()
    router.push({ name: 'chats', params: { id: group.id } })
  } catch (e) {
    createError.value = ApiError.from(e).message || "Couldn't create the group."
  } finally {
    creating.value = false
  }
}

watch(
  isOpen,
  (shouldBeOpen) => {
    const el = dialog.value
    if (!el) return
    if (shouldBeOpen && !el.open) {
      resetForm()
      el.showModal()
      // Refresh in the background so friends added elsewhere show up.
      relationStore.fetchAll()
    } else if (!shouldBeOpen && el.open) {
      el.close()
    }
  },
  { flush: 'post' },
)

// Leaving the page with the dialog open (e.g. Back) must not leave `isOpen` stuck at true.
onBeforeUnmount(close)
</script>

<template>
  <!-- `close` also fires on Escape, keeping `isOpen` in sync. -->
  <dialog ref="dialog" class="modal" aria-labelledby="new-group-title" @close="close" @cancel="preventEscapeWhileCreating">
    <form class="modal-box flex max-h-[80vh] flex-col gap-4 bg-sidebar p-5" @submit.prevent="createGroup">
      <div class="flex items-center justify-between">
        <h2 id="new-group-title" class="text-lg font-semibold">New group</h2>
        <button
          type="button"
          class="flex size-8 items-center justify-center rounded-full text-base-content/60 hover:bg-hover"
          aria-label="Close"
          :disabled="creating"
          @click="close"
        >
          <X class="size-4" aria-hidden="true" />
        </button>
      </div>

      <label class="flex flex-col gap-1.5">
        <span class="flex justify-between text-xs font-semibold tracking-wide text-base-content/50 uppercase">
          Group name
          <span class="font-normal normal-case">{{ groupName.length }}/{{ MAX_GROUP_NAME_LENGTH }}</span>
        </span>
        <input
          v-model="groupName"
          type="text"
          required
          :maxlength="MAX_GROUP_NAME_LENGTH"
          placeholder="e.g. Project Team"
          class="input w-full rounded-lg border-base-content/10 bg-background shadow-none focus:border-base-content/20 focus:outline-none focus-within:outline-none"
        />
      </label>

      <div class="flex min-h-0 flex-1 flex-col gap-2">
        <div class="flex items-baseline justify-between">
          <span class="text-xs font-semibold tracking-wide text-base-content/50 uppercase">Members</span>
          <span class="text-xs" :class="tooManyMembers ? 'text-error' : 'text-base-content/50'">
            {{ selectedCount }}/{{ MAX_MEMBERS }} selected
          </span>
        </div>
        <SearchBar v-model="searchQuery" placeholder="Search friends" />

        <div class="-mx-2 min-h-32 flex-1 overflow-y-auto">
          <p v-if="!relationStore.loaded && relationStore.loading" class="px-2 py-2 text-sm text-base-content/50">
            Loading…
          </p>
          <p v-else-if="relationStore.error && !relationStore.loaded" class="px-2 py-2 text-sm text-error">
            Couldn't load your friends.
            <button type="button" class="link" @click="relationStore.fetchAll">Retry</button>
          </p>
          <p v-else-if="!relationStore.friendsByName.length" class="px-2 py-2 text-sm text-base-content/50">
            You can only create a group with your friends. Add friends in the Friends tab first.
          </p>
          <p v-else-if="!matchingPeople.length" class="px-2 py-2 text-sm text-base-content/50">No friends found.</p>
          <ul v-else>
            <li v-for="person in matchingPeople" :key="person.id">
              <button
                type="button"
                class="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-hover-subtle"
                :aria-pressed="selectedUserIds.has(person.id)"
                @click="toggleSelected(person.id)"
              >
                <UserAvatar :name="person.display_name" />
                <span class="min-w-0 flex-1">
                  <span class="block truncate font-semibold">{{ person.display_name }}</span>
                  <span v-if="person.username" class="block truncate text-sm text-base-content/50">@{{ person.username }}</span>
                </span>
                <span
                  class="flex size-5 shrink-0 items-center justify-center rounded-full border"
                  :class="selectedUserIds.has(person.id) ? 'border-primary bg-primary text-primary-content' : 'border-base-content/30'"
                  aria-hidden="true"
                >
                  <Check v-if="selectedUserIds.has(person.id)" class="size-3" :stroke-width="3" />
                </span>
              </button>
            </li>
          </ul>
        </div>
      </div>

      <p v-if="createError" class="text-sm text-error">{{ createError }}</p>
      <p
        v-else-if="whyCreateIsDisabled && !creating"
        class="text-sm"
        :class="tooManyMembers ? 'text-error' : 'text-base-content/50'"
      >
        {{ whyCreateIsDisabled }}
      </p>

      <div class="flex justify-end gap-2">
        <button type="button" class="ui-btn ui-btn-ghost" :disabled="creating" @click="close">Cancel</button>
        <button type="submit" class="ui-btn ui-btn-primary" :disabled="!canCreate">
          {{ creating ? 'Creating…' : 'Create group' }}
        </button>
      </div>
    </form>
    <form method="dialog" class="modal-backdrop">
      <button type="submit" aria-label="Close" :disabled="creating">close</button>
    </form>
  </dialog>
</template>
