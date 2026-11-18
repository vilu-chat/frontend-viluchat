import { ref } from 'vue'
import { defineStore } from 'pinia'
import * as userApi from '@/services/userService'
import type { User, UserMe, UserUpdate } from '@/types/api'
import { ApiError } from '@/utils/http'

const UNKNOWN_USER = 'Unknown user'

export const useUserStore = defineStore('users', () => {
  const currentUser = ref<UserMe | null>(null)
  const byId = ref<Record<string, User>>({})
  const currentUserError = ref<ApiError | null>(null)

  const lookupsInFlight = new Map<string, Promise<void>>()
  const unknownUserIds = new Set<string>()

  function cacheCurrentUser(user: UserMe) {
    currentUser.value = user
    byId.value[user.id] = {
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      bio: user.bio,
      status_text: user.status_text,
      avatar_url: user.avatar_url,
    }
  }

  async function fetchCurrentUser(): Promise<UserMe | null> {
    currentUserError.value = null
    try {
      cacheCurrentUser(await userApi.getCurrentUser())
      return currentUser.value
    } catch (e) {
      currentUserError.value = ApiError.from(e)
      return null
    }
  }

  async function updateCurrentUser(patch: UserUpdate): Promise<UserMe> {
    const updated = await userApi.updateCurrentUser(patch)
    cacheCurrentUser(updated)
    return updated
  }

  async function deleteCurrentUser(): Promise<void> {
    await userApi.deleteCurrentUser()
    if (currentUser.value) delete byId.value[currentUser.value.id]
    currentUser.value = null
  }

  async function ensureUsers(ids: Iterable<string>): Promise<void> {
    const lookupsToAwait = new Set<Promise<void>>()
    const idsToLookUp: string[] = []

    for (const id of new Set(ids)) {
      if (!id || byId.value[id] || unknownUserIds.has(id)) continue
      const inFlightLookup = lookupsInFlight.get(id)
      if (inFlightLookup) lookupsToAwait.add(inFlightLookup)
      else idsToLookUp.push(id)
    }

    if (idsToLookUp.length) {
      const lookupRequest = userApi
        .lookupUsers(idsToLookUp)
        .then((users) => {
          for (const user of users) byId.value[user.id] = user
          const found = new Set(users.map((u) => u.id))
          for (const id of idsToLookUp) if (!found.has(id)) unknownUserIds.add(id)
        })
        .finally(() => {
          for (const id of idsToLookUp) lookupsInFlight.delete(id)
        })
      for (const id of idsToLookUp) lookupsInFlight.set(id, lookupRequest)
      lookupsToAwait.add(lookupRequest)
    }

    await Promise.all(lookupsToAwait)
  }

  function displayName(id: string | null | undefined): string {
    if (!id) return UNKNOWN_USER
    return byId.value[id]?.display_name ?? UNKNOWN_USER
  }

  return { currentUser, byId, currentUserError, fetchCurrentUser, updateCurrentUser, deleteCurrentUser, ensureUsers, displayName }
})
