<script setup lang="ts">
import { ref } from 'vue'
import SearchBar from '@/components/shared/SearchBar.vue'
import SidebarTabs from '@/components/sidebar/SidebarTabs.vue'
import CurrentUserCard from '@/components/sidebar/CurrentUserCard.vue'

const search = ref('')
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col gap-3 p-4">
    <SearchBar v-model="search" placeholder="Search" />
    <SidebarTabs />
    <!-- The active route decides what goes here (e.g. ConversationList on /chats). -->
    <div class="-mx-2 min-h-0 flex-1 overflow-y-auto">
      <RouterView name="sidebar" />
    </div>
    <CurrentUserCard />
  </div>
</template>
