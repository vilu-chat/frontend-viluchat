<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Check, UserPlus, X } from '@lucide/vue'
import { useAddFriendDialog } from '@/composables/useAddFriendDialog'
import { useRelationStore } from '@/stores/relations'
import { ApiError } from '@/utils/http'
import FriendRow from '@/components/friends/FriendRow.vue'

const relations = useRelationStore()
const addFriendDialog = useAddFriendDialog()

const busyId = ref<string | null>(null)
const actionError = ref<string | null>(null)

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

const iconButton =
  'flex size-7 shrink-0 items-center justify-center rounded-full text-base-content/60 hover:bg-hover hover:text-base-content disabled:opacity-40'

onMounted(relations.fetchAll)
</script>

<template>
  <div class="flex flex-col gap-4">
    <p v-if="relations.error && !relations.loaded" class="px-2 py-1 text-sm text-error">
      Couldn't load friends.
      <button type="button" class="link" @click="relations.fetchAll">Retry</button>
    </p>
    <p v-if="actionError" class="px-2 text-sm text-error" role="alert">{{ actionError }}</p>

    <section v-if="relations.incoming.length" aria-labelledby="requests-heading">
      <h2 id="requests-heading" class="px-2 pb-1 text-xs font-semibold tracking-wide text-base-content/50 uppercase">
        Requests ({{ relations.incoming.length }})
      </h2>
      <ul>
        <li v-for="request in relations.incoming" :key="request.other_user_id" class="rounded-lg px-2 py-2">
          <FriendRow :user="request.user">
            <button
              type="button"
              :class="[iconButton, 'bg-primary text-primary-content hover:bg-primary-hover hover:text-primary-content']"
              :disabled="busyId === request.other_user_id"
              aria-label="Accept request"
              title="Accept"
              @click="accept(request.other_user_id)"
            >
              <Check class="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              :class="iconButton"
              :disabled="busyId === request.other_user_id"
              aria-label="Decline request"
              title="Decline"
              @click="remove(request.other_user_id)"
            >
              <X class="size-4" aria-hidden="true" />
            </button>
          </FriendRow>
        </li>
      </ul>
    </section>

    <section aria-labelledby="friends-heading">
      <div class="flex items-center justify-between px-2 pb-1">
        <h2 id="friends-heading" class="text-xs font-semibold tracking-wide text-base-content/50 uppercase">
          Friends
        </h2>
        <button
          type="button"
          class="flex size-6 items-center justify-center rounded-md text-base-content/60 hover:bg-hover hover:text-base-content"
          aria-label="Add friend"
          title="Add friend"
          @click="addFriendDialog.open"
        >
          <UserPlus class="size-4" aria-hidden="true" />
        </button>
      </div>
      <p v-if="relations.loaded && !relations.friendsByName.length" class="px-2 py-1 text-sm text-base-content/50">
        No friends yet. Use + to add one.
      </p>
      <ul>
        <li v-for="friend in relations.friendsByName" :key="friend.other_user_id" class="rounded-lg px-2 py-2 hover:bg-hover-subtle">
          <FriendRow :user="friend.user" />
        </li>
      </ul>
    </section>

    <section v-if="relations.outgoing.length" aria-labelledby="sent-heading">
      <h2 id="sent-heading" class="px-2 pb-1 text-xs font-semibold tracking-wide text-base-content/50 uppercase">
        Sent requests
      </h2>
      <ul>
        <li v-for="request in relations.outgoing" :key="request.other_user_id" class="rounded-lg px-2 py-2">
          <FriendRow :user="request.user">
            <button
              type="button"
              class="ui-btn ui-btn-ghost !px-2 !py-1 text-xs"
              :disabled="busyId === request.other_user_id"
              @click="remove(request.other_user_id)"
            >
              Cancel
            </button>
          </FriendRow>
        </li>
      </ul>
    </section>
  </div>
</template>
