<script setup lang="ts">
import { onMounted } from 'vue'
import AppSidebar from '@/components/sidebar/AppSidebar.vue'
import { useRelationStore } from '@/stores/relations'
import { useUserStore } from '@/stores/users'

const users = useUserStore()
const relations = useRelationStore()

onMounted(async () => {
  await users.fetchCurrentUser()
  relations.fetchAll()
})
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-background text-base-content">
    <aside class="flex w-70 shrink-0 flex-col border-r border-border bg-sidebar">
      <AppSidebar />
    </aside>

    <main class="flex min-w-0 flex-1 flex-col">
      <RouterView v-slot="{ Component }">
        <component :is="Component" v-if="Component" />
        <div v-else class="flex flex-1 items-center justify-center text-base-content/50">
          Main content (no view yet)
        </div>
      </RouterView>
    </main>

    <aside class="w-70 shrink-0 flex-col border-l border-border bg-sidebar">
      <div class="p-4 font-semibold">Files panel</div>
    </aside>
  </div>
</template>
