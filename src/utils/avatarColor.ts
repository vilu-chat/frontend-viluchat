const palette = ['#c2410c', '#7c3aed', '#15803d', '#be185d', '#0369a1', '#b45309', '#4338ca', '#0f766e']

/** Stable background color for an avatar, derived from an id. */
export function avatarColor(seed: string): string {
  let hash = 0
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) | 0
  return palette[Math.abs(hash) % palette.length]!
}
