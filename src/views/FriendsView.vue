<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Check, EllipsisVertical, MessageCircle, Users, X } from '@lucide/vue'
import { useAddFriendDialog } from '@/composables/useAddFriendDialog'
import { useConversationStore } from '@/stores/conversations'
import { useRelationStore } from '@/stores/relations'
import type { Relation } from '@/types/api'
import { ApiError } from '@/utils/http'
import AddFriendDialog from '@/components/friends/AddFriendDialog.vue'
import SearchBar from '@/components/shared/SearchBar.vue'
import UserAvatar from '@/components/shared/UserAvatar.vue'

type Tab = 'all' | 'pending'

const router = useRouter()
const relations = useRelationStore()
const conversations = useConversationStore()
const addFriendDialog = useAddFriendDialog()

const tab = ref<Tab>('all')
const search = ref('')
const busyId = ref<string | null>(null)
const actionError = ref<string | null>(null)

const pendingCount = computed(() => relations.incoming.length + relations.outgoing.length)

function matches(relation: Relation): boolean {
  const q = search.value.trim().toLowerCase().replace(/^@/, '')
  if (!q) return true
  return (
    relation.user.display_name.toLowerCase().includes(q) || (relation.user.username ?? '').toLowerCase().includes(q)
  )
}

const friends = computed(() => relations.friendsByName.filter(matches))
const incoming = computed(() => relations.incoming.filter(matches))
const outgoing = computed(() => relations.outgoing.filter(matches))

async function run(userId: string, action: () => Promise<unknown>) {
  busyId.value = userId
  actionError.value = null
  try {
    await action()
  } catch (e) {
    actionError.value = ApiError.from(e).message || 'Something went wrong.'
  } finally {
    busyId.value = null
  }
}

const accept = (id: string) => run(id, () => relations.acceptRequest(id))
const remove = (id: string) => run(id, () => relations.remove(id))

function message(userId: string) {
  return run(userId, async () => {
    const conversation = await conversations.openDirect(userId)
    router.push({ name: 'chats', params: { id: conversation.id } })
  })
}

function closeMenu(event: Event) {
  ;(event.currentTarget as HTMLElement).closest('details')?.removeAttribute('open')
}

const circleButton =
  'flex size-9 shrink-0 items-center justify-center rounded-full bg-base-content/10 text-base-content/70 transition-colors hover:text-base-content disabled:opacity-40'

function closeAllMenus() {
  document.querySelectorAll<HTMLDetailsElement>('details[data-friend-menu][open]').forEach((el) => el.removeAttribute('open'))
}

// Esc closes an open ⋮ menu; so does a click anywhere outside it.
function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  const open = document.querySelector<HTMLDetailsElement>('details[data-friend-menu][open]')
  if (!open) return
  closeAllMenus()
  open.querySelector('summary')?.focus()
  event.stopPropagation()
}

function onPointerDown(event: PointerEvent) {
  document.querySelectorAll<HTMLDetailsElement>('details[data-friend-menu][open]').forEach((el) => {
    if (!el.contains(event.target as Node)) el.removeAttribute('open')
  })
}

onMounted(() => {
  relations.fetchAll()
  document.addEventListener('keydown', onKeydown)
  document.addEventListener('pointerdown', onPointerDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  document.removeEventListener('pointerdown', onPointerDown)
})
</script>

<template>
  <div class="flex min-w-0 flex-1 flex-col bg-chat">
    <!-- Header: title and tabs -->
    <header class="flex items-center gap-2 border-b border-border px-6 py-3">
      <Users class="size-5 opacity-70" aria-hidden="true" />
      <h1 class="mr-3 font-semibold">Friends</h1>
      <button
        type="button"
        class="rounded-md px-3 py-1 font-semibold transition-colors"
        :class="tab === 'all' ? 'bg-base-content/10' : 'text-base-content/60 hover:bg-hover-subtle'"
        :aria-pressed="tab === 'all'"
        @click="tab = 'all'"
      >
        All
      </button>
      <button
        type="button"
        class="flex items-center gap-1.5 rounded-md px-3 py-1 font-semibold transition-colors"
        :class="tab === 'pending' ? 'bg-base-content/10' : 'text-base-content/60 hover:bg-hover-subtle'"
        :aria-pressed="tab === 'pending'"
        @click="tab = 'pending'"
      >
        Pending
        <span
          v-if="relations.incoming.length"
          class="flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] text-error-content"
        >
          {{ relations.incoming.length }}
        </span>
      </button>
      <button type="button" class="ui-btn ui-btn-primary ml-1" @click="addFriendDialog.open">Add Friend</button>
    </header>

    <div class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
      <SearchBar v-model="search" placeholder="Search" />

      <p v-if="relations.error && !relations.loaded" class="text-sm text-error">
        Couldn't load friends.
        <button type="button" class="link" @click="relations.fetchAll">Retry</button>
      </p>
      <p v-if="actionError" class="text-sm text-error" role="alert">{{ actionError }}</p>

      <!-- All friends -->
      <section v-if="tab === 'all'" aria-labelledby="all-heading">
        <h2 id="all-heading" class="pb-2 text-sm font-semibold text-base-content/70">
          All friends — {{ relations.friendsByName.length }}
        </h2>
        <p v-if="relations.loaded && !relations.friendsByName.length" class="py-4 text-sm text-base-content/50">
          No friends yet. Use “Add Friend” to search for a username.
        </p>
        <p v-else-if="relations.loaded && !friends.length" class="py-4 text-sm text-base-content/50">
          No friends match your search.
        </p>
        <ul class="border-t border-border">
          <li
            v-for="friend in friends"
            :key="friend.other_user_id"
            class="group flex items-center gap-3 border-b border-border px-2 py-3 hover:bg-hover-subtle"
          >
            <UserAvatar :name="friend.user.display_name" />
            <div class="min-w-0 flex-1">
              <span class="block truncate font-semibold">{{ friend.user.display_name }}</span>
              <span class="block truncate text-sm text-base-content/60">
                {{ friend.user.status_text || (friend.user.username ? `@${friend.user.username}` : '') }}
              </span>
            </div>
            <button
              type="button"
              :class="circleButton"
              :disabled="busyId === friend.other_user_id"
              :aria-label="`Message ${friend.user.display_name}`"
              title="Message"
              @click="message(friend.other_user_id)"
            >
              <MessageCircle class="size-4" aria-hidden="true" />
            </button>
            <details data-friend-menu class="dropdown dropdown-end">
              <summary
                :class="[circleButton, 'cursor-pointer list-none']"
                :aria-label="`More options for ${friend.user.display_name}`"
                title="More"
              >
                <EllipsisVertical class="size-4" aria-hidden="true" />
              </summary>
              <ul class="menu dropdown-content z-10 mt-1 w-44 rounded-lg border border-border bg-sidebar p-1 shadow-lg">
                <li>
                  <button
                    type="button"
                    class="text-error"
                    :disabled="busyId === friend.other_user_id"
                    @click="(e) => { closeMenu(e); remove(friend.other_user_id) }"
                  >
                    Remove friend
                  </button>
                </li>
              </ul>
            </details>
          </li>
        </ul>
      </section>

      <!-- Pending: received, then sent -->
      <template v-else>
        <p v-if="relations.loaded && !pendingCount" class="py-4 text-sm text-base-content/50">
          No pending friend requests.
        </p>

        <section v-if="incoming.length" aria-labelledby="incoming-heading">
          <h2 id="incoming-heading" class="pb-2 text-sm font-semibold text-base-content/70">
            Received — {{ incoming.length }}
          </h2>
          <ul class="border-t border-border">
            <li
              v-for="request in incoming"
              :key="request.other_user_id"
              class="flex items-center gap-3 border-b border-border px-2 py-3 hover:bg-hover-subtle"
            >
              <UserAvatar :name="request.user.display_name" />
              <div class="min-w-0 flex-1">
                <span class="block truncate font-semibold">{{ request.user.display_name }}</span>
                <span class="block truncate text-sm text-base-content/60">
                  {{ request.user.username ? `@${request.user.username}` : '' }} · Incoming friend request
                </span>
              </div>
              <button
                type="button"
                :class="[circleButton, '!bg-primary !text-primary-content hover:!bg-primary-hover']"
                :disabled="busyId === request.other_user_id"
                aria-label="Accept request"
                title="Accept"
                @click="accept(request.other_user_id)"
              >
                <Check class="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                :class="circleButton"
                :disabled="busyId === request.other_user_id"
                aria-label="Decline request"
                title="Decline"
                @click="remove(request.other_user_id)"
              >
                <X class="size-4" aria-hidden="true" />
              </button>
            </li>
          </ul>
        </section>

        <section v-if="outgoing.length" aria-labelledby="outgoing-heading">
          <h2 id="outgoing-heading" class="pb-2 text-sm font-semibold text-base-content/70">
            Sent — {{ outgoing.length }}
          </h2>
          <ul class="border-t border-border">
            <li
              v-for="request in outgoing"
              :key="request.other_user_id"
              class="flex items-center gap-3 border-b border-border px-2 py-3 hover:bg-hover-subtle"
            >
              <UserAvatar :name="request.user.display_name" />
              <div class="min-w-0 flex-1">
                <span class="block truncate font-semibold">{{ request.user.display_name }}</span>
                <span class="block truncate text-sm text-base-content/60">
                  {{ request.user.username ? `@${request.user.username}` : '' }} · Outgoing friend request
                </span>
              </div>
              <button
                type="button"
                :class="circleButton"
                :disabled="busyId === request.other_user_id"
                aria-label="Cancel request"
                title="Cancel request"
                @click="remove(request.other_user_id)"
              >
                <X class="size-4" aria-hidden="true" />
              </button>
            </li>
          </ul>
        </section>
      </template>
    </div>

    <AddFriendDialog />
  </div>
</template>
