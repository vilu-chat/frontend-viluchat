import { http } from '@/utils/http'
import type { Relation, RelationDirection, RelationKind, RelationPage, User, UserLookup, UserMe, UserUpdate } from '@/types/api'

/** Server-side limit for `POST /api/v1/users/lookup`. */
export const LOOKUP_MAX_IDS = 100

const encodePathSegment = encodeURIComponent

export function getCurrentUser(signal?: AbortSignal): Promise<UserMe> {
  return http.get<UserMe>('/v1/users/me', { signal })
}

export function updateCurrentUser(patch: UserUpdate, signal?: AbortSignal): Promise<UserMe> {
  return http.patch<UserMe>('/v1/users/me', patch, { signal })
}

export function deleteCurrentUser(signal?: AbortSignal): Promise<void> {
  return http.delete('/v1/users/me', { signal })
}

export function getUser(id: string, signal?: AbortSignal): Promise<User> {
  return http.get<User>(`/v1/users/${encodePathSegment(id)}`, { signal })
}

/** Batch profile lookup. Splits into chunks of ≤100 ids; unknown and deleted users are absent from the result. */
export async function lookupUsers(ids: string[], signal?: AbortSignal): Promise<User[]> {
  const unique = [...new Set(ids)]
  const chunks: string[][] = []
  for (let i = 0; i < unique.length; i += LOOKUP_MAX_IDS) chunks.push(unique.slice(i, i + LOOKUP_MAX_IDS))

  const results = await Promise.all(
    chunks.map((chunk) =>
      http.post<User[]>('/v1/users/lookup', { ids: chunk } satisfies UserLookup, { signal }),
    ),
  )
  return results.flat()
}

export function searchUsers(usernamePrefix: string, limit = 20, signal?: AbortSignal): Promise<User[]> {
  return http.get<User[]>('/v1/users/search', { query: { q: usernamePrefix, limit }, signal })
}

export interface ListRelationsParams {
  kind?: RelationKind
  direction?: RelationDirection
  limit?: number
  cursor?: string
}

export function listRelations(params: ListRelationsParams = {}, signal?: AbortSignal): Promise<RelationPage> {
  return http.get<RelationPage>('/v1/users/me/relations', { query: { ...params }, signal })
}

export function sendRelationRequest(otherUserId: string, signal?: AbortSignal): Promise<Relation> {
  return http.put<Relation>(`/v1/users/me/relations/${encodePathSegment(otherUserId)}`, undefined, { signal })
}

export function acceptRelationRequest(otherUserId: string, signal?: AbortSignal): Promise<Relation> {
  return http.post<Relation>(`/v1/users/me/relations/${encodePathSegment(otherUserId)}/accept`, undefined, { signal })
}

export function removeRelation(otherUserId: string, signal?: AbortSignal): Promise<void> {
  return http.delete(`/v1/users/me/relations/${encodePathSegment(otherUserId)}`, { signal })
}
