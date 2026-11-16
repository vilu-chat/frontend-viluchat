import { ref } from 'vue'
import { defineStore } from 'pinia'
import * as userApi from '@/services/userService'
import type { User, UserMe, UserUpdate } from '@/types/api'
import { ApiError } from '@/utils/http'

const UNKNOWN_USER = 'Unknown user'

export const useUserStore = defineStore('users', () => {
  const me = ref<UserMe | null>(null)
  const byId = ref<Record<string, User>>({})
  const meError = ref<ApiError | null>(null)

  // Bookkeeping only, deliberately not reactive.
  const inFlight = new Map<string, Promise<void>>()
  const notFound = new Set<string>()

  function cacheMe(user: UserMe) {
    me.value = user
    byId.value[user.id] = {
      id: user.id,
      display_name: user.display_name,
      bio: user.bio,
      status_text: user.status_text,
      avatar_url: user.avatar_url,
    }
  }

  /** Loads the current user. Records failures in `meError` instead of throwing. */
  async function fetchMe(): Promise<UserMe | null> {
    meError.value = null
    try {
      cacheMe(await userApi.getMe())
      return me.value
    } catch (e) {
      meError.value = ApiError.from(e)
      return null
    }
  }

  async function updateMe(patch: UserUpdate): Promise<UserMe> {
    const updated = await userApi.updateMe(patch)
    cacheMe(updated)
    return updated
  }

  async function deleteMe(): Promise<void> {
    await userApi.deleteMe()
    if (me.value) delete byId.value[me.value.id]
    me.value = null
  }

  /**
   * Makes sure profiles for `ids` are cached. Only uncached ids are looked up, in one batched call;
   * ids already being fetched by another caller reuse that request instead of starting a new one.
   */
  async function ensureUsers(ids: Iterable<string>): Promise<void> {
    const waitFor = new Set<Promise<void>>()
    const missing: string[] = []

    for (const id of new Set(ids)) {
      if (!id || byId.value[id] || notFound.has(id)) continue
      const pending = inFlight.get(id)
      if (pending) waitFor.add(pending)
      else missing.push(id)
    }

    if (missing.length) {
      const req = userApi
        .lookupUsers(missing)
        .then((users) => {
          for (const user of users) byId.value[user.id] = user
          const found = new Set(users.map((u) => u.id))
          for (const id of missing) if (!found.has(id)) notFound.add(id)
        })
        .finally(() => {
          for (const id of missing) inFlight.delete(id)
        })
      for (const id of missing) inFlight.set(id, req)
      waitFor.add(req)
    }

    await Promise.all(waitFor)
  }

  function displayName(id: string | null | undefined): string {
    if (!id) return UNKNOWN_USER
    return byId.value[id]?.display_name ?? UNKNOWN_USER
  }

  return { me, byId, meError, fetchMe, updateMe, deleteMe, ensureUsers, displayName }
})
