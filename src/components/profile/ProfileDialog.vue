<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { X } from '@lucide/vue'
import { useUserStore } from '@/stores/users'
import type { UserUpdate } from '@/types/api'
import { ApiError } from '@/utils/http'
import UserAvatar from '@/components/shared/UserAvatar.vue'

// API limits (`UserUpdate`).
const MAX_DISPLAY_NAME_LENGTH = 64
const MAX_STATUS_LENGTH = 140
const MAX_BIO_LENGTH = 500

const isOpen = defineModel<boolean>('open', { default: false })

const users = useUserStore()
const dialog = ref<HTMLDialogElement | null>(null)

const displayName = ref('')
const statusText = ref('')
const bio = ref('')
const saving = ref(false)
const saveError = ref<string | null>(null)

/** Cleared optional fields are sent as `null`. */
const changedFields = computed<UserUpdate>(() => {
  const me = users.me
  if (!me) return {}
  const changes: UserUpdate = {}
  const newDisplayName = displayName.value.trim()
  if (newDisplayName !== me.display_name) changes.display_name = newDisplayName
  const newStatusText = statusText.value.trim() || null
  if (newStatusText !== me.status_text) changes.status_text = newStatusText
  const newBio = bio.value.trim() || null
  if (newBio !== me.bio) changes.bio = newBio
  return changes
})

const hasChanges = computed(() => Object.keys(changedFields.value).length > 0)
const canSave = computed(() => !!displayName.value.trim() && hasChanges.value && !saving.value)

function fillFormFromProfile() {
  displayName.value = users.me?.display_name ?? ''
  statusText.value = users.me?.status_text ?? ''
  bio.value = users.me?.bio ?? ''
  saveError.value = null
}

function preventEscapeWhileSaving(event: Event) {
  if (saving.value) event.preventDefault()
}

async function save() {
  if (!canSave.value) return
  saving.value = true
  saveError.value = null
  try {
    await users.updateMe(changedFields.value)
    isOpen.value = false
  } catch (e) {
    saveError.value = ApiError.from(e).message || "Couldn't save your profile."
  } finally {
    saving.value = false
  }
}

// Opened before `GET /users/me` returned: fill the form once the profile arrives, so an untouched
// status and bio aren't saved as cleared.
watch(
  () => users.me,
  (me, previousMe) => {
    if (isOpen.value && me && !previousMe) fillFormFromProfile()
  },
)

watch(
  isOpen,
  (shouldBeOpen) => {
    const el = dialog.value
    if (!el) return
    if (shouldBeOpen && !el.open) {
      fillFormFromProfile()
      el.showModal()
    } else if (!shouldBeOpen && el.open) {
      el.close()
    }
  },
  { flush: 'post' },
)
</script>

<template>
  <!-- `close` also fires on Escape, keeping `isOpen` in sync. -->
  <dialog ref="dialog" class="modal" aria-labelledby="profile-title" @close="isOpen = false" @cancel="preventEscapeWhileSaving">
    <form class="modal-box flex flex-col gap-4 bg-sidebar p-5" @submit.prevent="save">
      <div class="flex items-center justify-between">
        <h2 id="profile-title" class="text-lg font-semibold">Edit profile</h2>
        <button
          type="button"
          class="flex size-8 items-center justify-center rounded-full text-base-content/60 hover:bg-hover"
          aria-label="Close"
          :disabled="saving"
          @click="isOpen = false"
        >
          <X class="size-4" aria-hidden="true" />
        </button>
      </div>

      <p v-if="!users.me" class="text-sm text-base-content/50">Your profile hasn't loaded yet.</p>

      <template v-else>
        <div class="flex items-center gap-3">
          <UserAvatar :name="displayName.trim() || users.me.display_name" />
          <div class="min-w-0">
            <div class="truncate font-semibold">{{ displayName.trim() || users.me.display_name }}</div>
            <div class="truncate text-sm text-base-content/50">{{ statusText.trim() || 'No status' }}</div>
          </div>
        </div>

        <label class="flex flex-col gap-1.5">
          <span class="flex justify-between text-xs font-semibold tracking-wide text-base-content/50 uppercase">
            Display name
            <span class="font-normal normal-case">{{ displayName.length }}/{{ MAX_DISPLAY_NAME_LENGTH }}</span>
          </span>
          <input
            v-model="displayName"
            type="text"
            required
            :maxlength="MAX_DISPLAY_NAME_LENGTH"
            class="input w-full rounded-lg border-base-content/10 bg-background shadow-none focus:border-base-content/20 focus:outline-none focus-within:outline-none"
          />
        </label>

        <label class="flex flex-col gap-1.5">
          <span class="flex justify-between text-xs font-semibold tracking-wide text-base-content/50 uppercase">
            Status
            <span class="font-normal normal-case">{{ statusText.length }}/{{ MAX_STATUS_LENGTH }}</span>
          </span>
          <input
            v-model="statusText"
            type="text"
            :maxlength="MAX_STATUS_LENGTH"
            placeholder="What are you up to?"
            class="input w-full rounded-lg border-base-content/10 bg-background shadow-none focus:border-base-content/20 focus:outline-none focus-within:outline-none"
          />
        </label>

        <label class="flex flex-col gap-1.5">
          <span class="flex justify-between text-xs font-semibold tracking-wide text-base-content/50 uppercase">
            Bio
            <span class="font-normal normal-case">{{ bio.length }}/{{ MAX_BIO_LENGTH }}</span>
          </span>
          <textarea
            v-model="bio"
            rows="4"
            :maxlength="MAX_BIO_LENGTH"
            placeholder="A few words about you"
            class="textarea w-full resize-none rounded-lg border-base-content/10 bg-background shadow-none focus:border-base-content/20 focus:outline-none focus-within:outline-none"
          />
        </label>
      </template>

      <p v-if="saveError" class="text-sm text-error">{{ saveError }}</p>

      <div class="flex justify-end gap-2">
        <button type="button" class="ui-btn ui-btn-ghost" :disabled="saving" @click="isOpen = false">Cancel</button>
        <button type="submit" class="ui-btn ui-btn-primary" :disabled="!canSave">
          {{ saving ? 'Saving…' : 'Save' }}
        </button>
      </div>
    </form>
    <form method="dialog" class="modal-backdrop">
      <button type="submit" aria-label="Close" :disabled="saving">close</button>
    </form>
  </dialog>
</template>
