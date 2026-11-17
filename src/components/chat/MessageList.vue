<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { ArrowDown } from '@lucide/vue'
import { useMessageStore } from '@/stores/messages'
import { useUserStore } from '@/stores/users'
import { formatDayDivider, localDayKey } from '@/utils/formatChatTime'
import MessageItem from '@/components/chat/MessageItem.vue'

const props = defineProps<{
  conversationId: string
  firstUnreadSeq?: number | null
}>()

const KEEP_FOLLOWING_NEW_MESSAGES_WITHIN_PX = 120
const SHOW_JUMP_TO_LATEST_BEYOND_PX = 400
const LOAD_OLDER_WITHIN_PX_OF_TOP = 200
const SAME_SENDER_GROUPING_WINDOW_MS = 5 * 60 * 1000

interface MessageRow {
  kind: 'message'
  key: string
  seq: number | null
  body: string | null
  senderId: string
  createdAt: string
  editedAt: string | null
  deletedAt: string | null
  status?: 'pending' | 'failed'
  clientMsgId: string
  showHeader: boolean
}
type Row = MessageRow | { kind: 'day'; key: string; label: string } | { kind: 'unread'; key: string }

const messageStore = useMessageStore()
const users = useUserStore()
const conversationMessages = computed(() => messageStore.get(props.conversationId))
const scrollContainer = ref<HTMLElement | null>(null)
const showJumpToLatest = ref(false)
let initialScrollDone = false

const rows = computed<Row[]>(() => {
  const state = conversationMessages.value
  if (!state) return []
  const myId = users.me?.id ?? ''

  const messages: Omit<MessageRow, 'showHeader'>[] = [
    ...state.messages.map((m) => ({
      kind: 'message' as const,
      // Keyed by client_msg_id so a pending row turns into its confirmed message in place.
      key: m.client_msg_id || m.id,
      seq: m.seq,
      body: m.body,
      senderId: m.sender_id,
      createdAt: m.created_at,
      editedAt: m.edited_at,
      deletedAt: m.deleted_at,
      clientMsgId: m.client_msg_id,
    })),
    ...state.outgoing.map((o) => ({
      kind: 'message' as const,
      key: o.client_msg_id,
      seq: null,
      body: o.body,
      senderId: myId,
      createdAt: o.created_at,
      editedAt: null,
      deletedAt: null,
      status: o.status,
      clientMsgId: o.client_msg_id,
    })),
  ]

  // If the first unread message isn't loaded yet, the line sits at the top until older pages arrive.
  const firstUnreadSeq = props.firstUnreadSeq
  const unreadLineIndex =
    firstUnreadSeq == null
      ? -1
      : messages.findIndex((m) => m.seq !== null && m.seq >= firstUnreadSeq && m.senderId !== myId)

  const result: Row[] = []
  messages.forEach((message, i) => {
    const previous = messages[i - 1]
    const startsNewDay = !previous || localDayKey(previous.createdAt) !== localDayKey(message.createdAt)
    if (startsNewDay) {
      result.push({
        kind: 'day',
        key: `day-${localDayKey(message.createdAt)}`,
        label: formatDayDivider(message.createdAt),
      })
    }
    if (i === unreadLineIndex) result.push({ kind: 'unread', key: 'unread' })

    const continuesPrevious =
      previous !== undefined &&
      !startsNewDay &&
      previous.senderId === message.senderId &&
      previous.deletedAt === null &&
      Date.parse(message.createdAt) - Date.parse(previous.createdAt) <= SAME_SENDER_GROUPING_WINDOW_MS
    result.push({ ...message, showHeader: !continuesPrevious })
  })
  return result
})

function firstMessageKey(rowList: Row[]): string | undefined {
  return rowList.find((r) => r.kind === 'message')?.key
}

function distanceFromBottom(el: HTMLElement): number {
  return el.scrollHeight - el.scrollTop - el.clientHeight
}

function scrollToBottom(behavior: ScrollBehavior = 'auto') {
  const el = scrollContainer.value
  if (el) el.scrollTo({ top: el.scrollHeight, behavior })
}

/** To the "New messages" line if there is one, otherwise to the newest message. */
function scrollToStartingPosition() {
  const el = scrollContainer.value
  if (!el || initialScrollDone || !rows.value.some((r) => r.kind === 'message')) return
  initialScrollDone = true
  const unreadLine = el.querySelector<HTMLElement>('[data-unread-line]')
  if (unreadLine) unreadLine.scrollIntoView({ block: 'center' })
  else scrollToBottom()
}

function loadOlderIfNearTop() {
  const el = scrollContainer.value
  const state = conversationMessages.value
  if (!el || !state?.loaded || !state.hasMoreOlder || state.loading || state.error) return
  if (el.scrollTop < LOAD_OLDER_WITHIN_PX_OF_TOP) messageStore.loadOlder(props.conversationId)
}

function onScroll() {
  const el = scrollContainer.value
  if (el) showJumpToLatest.value = distanceFromBottom(el) > SHOW_JUMP_TO_LATEST_BEYOND_PX
  loadOlderIfNearTop()
}

// Runs before the DOM update: measure the scroll position now, then correct it afterwards.
watch(rows, async (newRows, oldRows) => {
  const el = scrollContainer.value
  if (!el) return
  const wasNearBottom = distanceFromBottom(el) < KEEP_FOLLOWING_NEW_MESSAGES_WITHIN_PX
  const oldScrollHeight = el.scrollHeight
  const oldScrollTop = el.scrollTop

  const oldFirstKey = firstMessageKey(oldRows)
  const olderMessagesAdded = !!oldFirstKey && firstMessageKey(newRows) !== oldFirstKey
  const oldKeys = new Set(oldRows.map((r) => r.key))
  const iJustSentOne = newRows.some((r) => r.kind === 'message' && r.status === 'pending' && !oldKeys.has(r.key))

  await nextTick()
  if (!initialScrollDone) {
    scrollToStartingPosition()
  } else if (olderMessagesAdded && !iJustSentOne) {
    // Keep the messages the user is looking at in place.
    el.scrollTop = oldScrollTop + (el.scrollHeight - oldScrollHeight)
  } else if (wasNearBottom || iJustSentOne) {
    scrollToBottom()
  }
  onScroll()
})

onMounted(() => {
  scrollToStartingPosition()
  onScroll()
})

function retryLoading() {
  if (conversationMessages.value?.loaded) messageStore.loadOlder(props.conversationId)
  else messageStore.loadLatest(props.conversationId)
}
</script>

<template>
  <div class="relative flex min-h-0 flex-1 flex-col">
    <div ref="scrollContainer" class="min-h-0 flex-1 overflow-y-auto [overflow-anchor:none]" @scroll.passive="onScroll">
      <div class="flex min-h-full flex-col justify-end pb-4">
        <div class="px-4 pt-4 text-center text-sm text-base-content/50">
          <div v-if="conversationMessages?.loading">Loading…</div>
          <div v-else-if="conversationMessages?.error" class="text-error">
            Couldn't load messages.
            <button type="button" class="link" @click="retryLoading">Retry</button>
          </div>
          <div v-else-if="conversationMessages?.loaded && !conversationMessages.hasMoreOlder">Start of conversation</div>
        </div>

        <template v-for="row in rows" :key="row.key">
          <div v-if="row.kind === 'day'" class="mx-4 mt-6 mb-2 flex items-center gap-3" role="separator">
            <span class="h-px flex-1 bg-border" />
            <span class="text-xs font-semibold text-base-content/50">{{ row.label }}</span>
            <span class="h-px flex-1 bg-border" />
          </div>

          <div
            v-else-if="row.kind === 'unread'"
            data-unread-line
            class="mx-4 mt-3 flex items-center gap-2"
            role="separator"
            aria-label="New messages"
          >
            <span class="h-px flex-1 bg-error" />
            <span class="rounded bg-error px-1.5 py-px text-[10px] font-bold text-error-content uppercase">
              New messages
            </span>
          </div>

          <MessageItem
            v-else
            :body="row.body"
            :sender-id="row.senderId"
            :created-at="row.createdAt"
            :edited-at="row.editedAt"
            :deleted-at="row.deletedAt"
            :show-header="row.showHeader"
            :status="row.status"
            @retry="messageStore.retry(conversationId, row.clientMsgId)"
            @discard="messageStore.discard(conversationId, row.clientMsgId)"
          />
        </template>
      </div>
    </div>

    <Transition
      enter-active-class="transition duration-150"
      enter-from-class="translate-y-2 opacity-0"
      leave-active-class="transition duration-150"
      leave-to-class="translate-y-2 opacity-0"
    >
      <button
        v-if="showJumpToLatest"
        type="button"
        class="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-content shadow-lg transition-colors hover:bg-primary-hover"
        @click="scrollToBottom('smooth')"
      >
        <ArrowDown class="size-3.5" aria-hidden="true" />
        Jump to latest
      </button>
    </Transition>
  </div>
</template>
