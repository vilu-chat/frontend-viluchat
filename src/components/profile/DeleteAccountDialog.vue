<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { currentSession, logout } from '@/lib/auth'
import { useUserStore } from '@/stores/users'
import { ApiError } from '@/utils/http'

const isOpen = defineModel<boolean>('open', { default: false })

const users = useUserStore()
const dialog = ref<HTMLDialogElement | null>(null)
const deleting = ref(false)
const deleteError = ref<string | null>(null)

const confirmationPhrase = computed(() => `DELETE @${currentSession.value?.user.preferred_username ?? ''}`)
const typedConfirmation = ref('')
const confirmationMatches = computed(() => typedConfirmation.value.trim() === confirmationPhrase.value)

function preventEscapeWhileDeleting(event: Event) {
  if (deleting.value) event.preventDefault()
}

async function deleteAccount() {
  if (!confirmationMatches.value) return
  deleting.value = true
  deleteError.value = null
  try {
    await users.deleteMe()
    // Full page load to /login, which also drops all cached data.
    logout('account_deleted')
  } catch (e) {
    deleteError.value = ApiError.from(e).message || "Couldn't delete your account."
    deleting.value = false
  }
}

watch(
  isOpen,
  (shouldBeOpen) => {
    const el = dialog.value
    if (!el) return
    if (shouldBeOpen && !el.open) {
      deleteError.value = null
      typedConfirmation.value = ''
      el.showModal()
    } else if (!shouldBeOpen && el.open) {
      el.close()
    }
  },
  { flush: 'post' },
)
</script>

<template>
  <dialog ref="dialog" class="modal" aria-labelledby="delete-account-title" @close="isOpen = false" @cancel="preventEscapeWhileDeleting">
    <form class="modal-box flex flex-col gap-4 bg-sidebar p-5" @submit.prevent="deleteAccount">
      <h2 id="delete-account-title" class="text-lg font-semibold">Delete account?</h2>
      <p class="text-sm text-base-content/70">
        Your profile will be removed and you'll be logged out. This can't be undone.
      </p>
      <label class="flex flex-col gap-1.5">
        <span class="text-sm text-base-content/70">
          Type <span class="font-mono font-semibold text-base-content">"<span class="select-all">{{ confirmationPhrase }}</span>"</span> to confirm.
        </span>
        <input
          v-model="typedConfirmation"
          type="text"
          autocomplete="off"
          spellcheck="false"
          :disabled="deleting"
          class="input w-full rounded-lg border-base-content/10 bg-background font-mono shadow-none focus:border-base-content/20 focus:outline-none focus-within:outline-none"
        />
      </label>
      <p v-if="deleteError" class="text-sm text-error">{{ deleteError }}</p>
      <div class="flex justify-end gap-2">
        <button type="button" class="ui-btn ui-btn-ghost" :disabled="deleting" @click="isOpen = false">Cancel</button>
        <button type="submit" class="ui-btn ui-btn-danger" :disabled="deleting || !confirmationMatches">
          {{ deleting ? 'Deleting…' : 'Delete account' }}
        </button>
      </div>
    </form>
    <form method="dialog" class="modal-backdrop">
      <button type="submit" aria-label="Close" :disabled="deleting">close</button>
    </form>
  </dialog>
</template>
