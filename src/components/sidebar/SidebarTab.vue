<script setup lang="ts">
import type { Component } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

defineProps<{
  to: RouteLocationRaw
  label: string
  icon: Component
  badge?: number
}>()
</script>

<template>
  <RouterLink
    :to="to"
    class="flex flex-col items-center gap-0.5 rounded-lg py-1.5 text-xs text-base-content/60 transition-colors hover:bg-hover-subtle hover:text-base-content"
    active-class="!bg-base-content/10 !text-base-content"
  >
    <span class="relative">
      <component :is="icon" class="size-5" aria-hidden="true" />
      <span
        v-if="badge"
        class="absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] font-semibold text-error-content"
        aria-hidden="true"
      >
        {{ badge > 9 ? '9+' : badge }}
      </span>
    </span>
    {{ label }}
    <span v-if="badge" class="sr-only">({{ badge }} new)</span>
  </RouterLink>
</template>
