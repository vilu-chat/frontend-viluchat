<script setup lang="ts">
import { onMounted } from 'vue'
import AppSidebar from '@/components/sidebar/AppSidebar.vue'
import { useUserStore } from '@/stores/users'

const users = useUserStore()

// Needed to tell own messages apart (`fromMe`) and to name direct chats after the other member.
onMounted(users.fetchMe)
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-background text-base-content">
    <!-- Left: navigation sidebar -->
    <aside class="flex w-80 shrink-0 flex-col border-r border-border bg-sidebar">
      <AppSidebar />
    </aside>

    <!-- Middle: whatever the current route renders (ChatView, FriendsView, ...) -->
    <main class="flex min-w-0 flex-1 flex-col">
      <RouterView v-slot="{ Component }">
        <component :is="Component" v-if="Component" />
        <div v-else class="flex flex-1 items-center justify-center text-base-content/50">
          Main content (no view yet)
        </div>
      </RouterView>
    </main>

    <!-- Right: contextual panel → replace with <FilesPanel /> -->
    <aside class="hidden w-80 shrink-0 flex-col border-l border-border bg-sidebar xl:flex">
      <div class="p-4 font-semibold">Files panel</div>
    </aside>
  </div>
</template>
