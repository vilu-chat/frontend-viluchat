<script setup lang="ts">
import { computed } from 'vue'
import { avatarColor } from '@/utils/avatarColor'

const props = withDefaults(defineProps<{ name: string; size?: 'xs' | 'md'; online?: boolean }>(), {
  size: 'md',
  online: false,
})

const initials = computed(() => {
  const letters = props.name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0]!.toUpperCase())
  return (props.size === 'xs' ? letters.slice(0, 1) : letters.slice(0, 2)).join('')
})
</script>

<template>
  <div
    class="relative flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
    :class="size === 'xs' ? 'size-[19px] text-[8px]' : 'size-10 text-sm'"
    :style="{ backgroundColor: avatarColor(name) }"
    aria-hidden="true"
  >
    {{ initials }}
    <span
      v-if="online"
      class="absolute right-0 bottom-0 size-3 rounded-full bg-success ring-2 ring-sidebar"
    />
  </div>
</template>
