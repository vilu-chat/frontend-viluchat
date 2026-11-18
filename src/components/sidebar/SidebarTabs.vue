<script setup lang="ts">
import { computed, type Component } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { Bell, MessageCircle, User, Users } from '@lucide/vue'
import SidebarTab from '@/components/sidebar/SidebarTab.vue'
import { useRelationStore } from '@/stores/relations'

const props = withDefaults(defineProps<{ alertCount?: number }>(), { alertCount: 0 })

const relations = useRelationStore()

interface Tab {
  to: RouteLocationRaw
  label: string
  icon: Component
  badge?: number
}

const tabs = computed<Tab[]>(() => [
  { to: { name: 'chats' }, label: 'Chats', icon: MessageCircle },
  { to: { name: 'friends' }, label: 'Friends', icon: User, badge: relations.incoming.length },
  { to: { name: 'groups' }, label: 'Groups', icon: Users },
  { to: { name: 'alerts' }, label: 'Alerts', icon: Bell, badge: props.alertCount },
])
</script>

<template>
  <nav aria-label="Sidebar sections" class="grid grid-cols-4 gap-1">
    <SidebarTab v-for="tab in tabs" :key="tab.label" v-bind="tab" />
  </nav>
</template>
