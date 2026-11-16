<script setup lang="ts">
import { Search } from '@lucide/vue'

const query = defineModel<string>({ default: '' })

defineProps<{ placeholder: string }>()
</script>

<template>
  <label
    class="input input-sm w-full rounded-lg border-0 bg-base-content/10 shadow-none focus-within:bg-base-content/15 focus-within:shadow-none focus-within:outline-none"
  >
    <Search class="size-4 opacity-50" :stroke-width="2.5" aria-hidden="true" />
    <input v-model="query" type="search" :placeholder="placeholder" :aria-label="placeholder" />
  </label>
</template>
