import { http } from '@/utils/http'
import type { User, UserLookup, UserMe, UserUpdate } from '@/types/api'

/** Server-side limit for `POST /api/v1/users/lookup`. */
export const LOOKUP_MAX_IDS = 100

const enc = encodeURIComponent

export function getMe(signal?: AbortSignal): Promise<UserMe> {
  return http.get<UserMe>('/v1/users/me', { signal })
}

export function updateMe(patch: UserUpdate, signal?: AbortSignal): Promise<UserMe> {
  return http.patch<UserMe>('/v1/users/me', patch, { signal })
}

export function deleteMe(signal?: AbortSignal): Promise<void> {
  return http.delete('/v1/users/me', { signal })
}

export function getUser(id: string, signal?: AbortSignal): Promise<User> {
  return http.get<User>(`/v1/users/${enc(id)}`, { signal })
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
