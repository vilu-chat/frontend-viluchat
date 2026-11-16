import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import { loadConfig } from './lib/config'
import { setupAuth } from './lib/auth'
import './assets/main.css'

await loadConfig()
setupAuth()

createApp(App).use(createPinia()).use(router).mount('#app')
