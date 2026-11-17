<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { Folder, Paperclip } from '@lucide/vue'

defineProps<{ placeholder: string }>()
const emit = defineEmits<{ send: [body: string] }>()

const MAX_MESSAGE_LENGTH = 4000
const MAX_TEXTAREA_HEIGHT_PX = 240

/** Owned by the parent so it survives switching conversations. */
const draft = defineModel<string>({ default: '' })
const textarea = ref<HTMLTextAreaElement | null>(null)

function fitTextareaToContent() {
  const el = textarea.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT_PX)}px`
}

async function send() {
  const body = draft.value.trim()
  if (!body) return
  emit('send', body)
  draft.value = ''
  await nextTick()
  fitTextareaToContent()
}

// Shift+Enter falls through and inserts a newline.
function sendOnEnter(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault()
    send()
  }
}

// A restored draft may span several lines.
onMounted(fitTextareaToContent)

// TODO: uploads don't exist yet; attachments will end up in the Files panel.
function attachFile() {}
</script>

<template>
  <form class="shrink-0 border-t border-border px-4 pt-2 pb-4" @submit.prevent="send">
    <p class="mb-2 flex items-center gap-1.5 pl-14 text-xs text-base-content/40">
      <Folder class="size-3" aria-hidden="true" />
      Attachments save to <span class="text-primary">Files</span>
    </p>

    <div class="flex items-end gap-3">
      <button
        type="button"
        class="flex size-10 shrink-0 items-center justify-center rounded-full bg-hover text-base-content/70 transition-colors hover:bg-hover-strong hover:text-base-content"
        aria-label="Attach file"
        title="Attach file"
        @click="attachFile"
      >
        <Paperclip class="size-4" aria-hidden="true" />
      </button>

      <div
        class="flex min-h-10 flex-1 items-center rounded-[20px] border border-base-content/10 bg-background px-4 py-2 focus-within:border-base-content/20"
      >
        <textarea
          ref="textarea"
          v-model="draft"
          rows="1"
          :maxlength="MAX_MESSAGE_LENGTH"
          :placeholder="placeholder"
          :aria-label="placeholder"
          class="max-h-60 flex-1 resize-none bg-transparent text-sm leading-6 outline-none placeholder:text-base-content/40"
          @input="fitTextareaToContent"
          @keydown="sendOnEnter"
        />
      </div>
    </div>
  </form>
</template>
