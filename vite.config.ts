import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Where the cluster ingress (or a port-forward) is reachable during local dev.
  const target = env.DEV_PROXY_TARGET ?? 'http://localhost:8080'

  return {
    plugins: [vue(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      // Mirror the ingress paths so the app uses same-origin URLs in dev and prod.
      proxy: {
        '/api': { target, changeOrigin: true },
        '/auth': { target, changeOrigin: true },
        // Dev auth stub: token endpoint and the seeded users for the login picker.
        '/realms': { target, changeOrigin: true },
        '/dev/users': { target, changeOrigin: true },
        '/ws': { target, changeOrigin: true, ws: true },
      },
    },
  }
})
