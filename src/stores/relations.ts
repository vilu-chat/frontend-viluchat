import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import * as userApi from '@/services/userService'
import { useUserStore } from '@/stores/users'
import type { Relation, RelationDirection, RelationKind } from '@/types/api'
import { ApiError } from '@/utils/http'

const PAGE_SIZE = 100

export type FriendStatus = 'friend' | 'request-sent' | 'request-received' | null

export const useRelationStore = defineStore('relations', () => {
  const users = useUserStore()

  const contacts = ref<Relation[]>([])
  const incoming = ref<Relation[]>([])
  const outgoing = ref<Relation[]>([])
  const loaded = ref(false)
  const loading = ref(false)
  const error = ref<ApiError | null>(null)

  let latestFetchId = 0

  const friendIds = computed(() => new Set(contacts.value.map((relation) => relation.other_user_id)))

  const friendsByName = computed(() =>
    [...contacts.value].sort((a, b) => a.user.display_name.localeCompare(b.user.display_name)),
  )

  function cacheProfiles(relations: Relation[]) {
    for (const relation of relations) users.byId[relation.user.id] = relation.user
  }

  async function loadAllPages(kind: RelationKind, direction?: RelationDirection): Promise<Relation[]> {
    const all: Relation[] = []
    let cursor: string | undefined
    do {
      const page = await userApi.listRelations({ kind, direction, limit: PAGE_SIZE, cursor })
      all.push(...page.items)
      cursor = page.next_cursor ?? undefined
    } while (cursor)
    return all
  }

  async function fetchAll(): Promise<void> {
    const thisFetchId = ++latestFetchId
    loading.value = true
    error.value = null
    try {
      const [contactList, incomingList, outgoingList] = await Promise.all([
        loadAllPages('contact'),
        loadAllPages('pending', 'incoming'),
        loadAllPages('pending', 'outgoing'),
      ])
      if (thisFetchId !== latestFetchId) return
      contacts.value = contactList
      incoming.value = incomingList
      outgoing.value = outgoingList
      cacheProfiles([...contactList, ...incomingList, ...outgoingList])
      loaded.value = true
    } catch (e) {
      if (thisFetchId === latestFetchId) error.value = ApiError.from(e)
    } finally {
      if (thisFetchId === latestFetchId) loading.value = false
    }
  }

  const loadIfNeeded = () => (loaded.value || loading.value ? Promise.resolve() : fetchAll())

  function statusOf(userId: string): FriendStatus {
    if (friendIds.value.has(userId)) return 'friend'
    if (outgoing.value.some((relation) => relation.other_user_id === userId)) return 'request-sent'
    if (incoming.value.some((relation) => relation.other_user_id === userId)) return 'request-received'
    return null
  }

  function removeFromAllLists(userId: string) {
    contacts.value = contacts.value.filter((relation) => relation.other_user_id !== userId)
    incoming.value = incoming.value.filter((relation) => relation.other_user_id !== userId)
    outgoing.value = outgoing.value.filter((relation) => relation.other_user_id !== userId)
  }

  /** Throws ApiError. On a 409/404 the lists are reloaded so the screen shows the real state. */
  async function sendRequest(userId: string): Promise<void> {
    try {
      const relation = await userApi.sendRelationRequest(userId)
      cacheProfiles([relation])
      outgoing.value = [relation, ...outgoing.value.filter((relation) => relation.other_user_id !== userId)]
    } catch (e) {
      const err = ApiError.from(e)
      if (err.status === 409 || err.status === 404) await fetchAll()
      throw err
    }
  }

  async function acceptRequest(userId: string): Promise<void> {
    try {
      const relation = await userApi.acceptRelationRequest(userId)
      cacheProfiles([relation])
      removeFromAllLists(userId)
      contacts.value = [relation, ...contacts.value]
    } catch (e) {
      const err = ApiError.from(e)
      if (err.status === 404) await fetchAll() // the request was cancelled or the user is gone
      throw err
    }
  }

  async function remove(userId: string): Promise<void> {
    await userApi.removeRelation(userId)
    removeFromAllLists(userId)
  }

  return {
    contacts,
    incoming,
    outgoing,
    loaded,
    loading,
    error,
    friendIds,
    friendsByName,
    fetchAll,
    loadIfNeeded,
    statusOf,
    sendRequest,
    acceptRequest,
    remove,
  }
})
