import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// Local dev only: the docker-compose stack publishes each service on its own port.
// On k8s the ingress does this routing, so this proxy is not used there.
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      // Order matters: the specific users path must come before the generic /api.
      '/api/v1/users': { target: 'http://localhost:8001', changeOrigin: true }, // user-service
      '/api': { target: 'http://localhost:8002', changeOrigin: true }, // message-service
      // Dev auth stub: token endpoint and the seeded users for the login picker.
      '/realms': { target: 'http://localhost:8081', changeOrigin: true },
      '/dev/users': { target: 'http://localhost:8081', changeOrigin: true },
    },
  },
})
