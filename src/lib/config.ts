/** Runtime config served as `/config.json` (mounted from a ConfigMap in the cluster). */
export interface AppConfig {
  keycloak: {
    url: string
    realm: string
    clientId: string
  }
  apiBaseUrl: string
  wsUrl: string
  vapidPublicKey: string
}

let config: AppConfig | null = null

/** Fetches `/config.json` once. Must be awaited before the app mounts. */
export async function loadConfig(): Promise<AppConfig> {
  if (config) return config
  const res = await fetch('/config.json', { cache: 'no-store' })
  if (!res.ok) throw new Error(`Failed to load /config.json (${res.status})`)
  config = (await res.json()) as AppConfig
  return config
}

export function getConfig(): AppConfig {
  if (!config) throw new Error('Config not loaded — call loadConfig() before using getConfig()')
  return config
}
