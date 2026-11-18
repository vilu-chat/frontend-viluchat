<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useConversationStore } from '@/stores/conversations'

const store = useConversationStore()
const footer = ref<HTMLElement | null>(null)
const isFooterVisible = ref(false)
let observer: IntersectionObserver | null = null

function loadNextPageIfVisible() {
  if (isFooterVisible.value && store.nextCursor && !store.loading && !store.error) store.fetchNextPage()
}

onMounted(() => {
  observer = new IntersectionObserver(
    ([entry]) => {
      isFooterVisible.value = entry!.isIntersecting
      loadNextPageIfVisible()
    },
    { rootMargin: '200px' },
  )
  observer.observe(footer.value!)
})

onBeforeUnmount(() => observer?.disconnect())

// A short page can leave the footer in view, which fires no new intersection event. Re-observing
// reports the current state, so loading continues until the footer is pushed out of view.
watch(
  () => store.loading,
  async (loading) => {
    if (loading || !observer || !footer.value) return
    await nextTick()
    observer.unobserve(footer.value)
    observer.observe(footer.value)
  },
)
</script>

<template>
  <div ref="footer" class="px-2 py-2 text-center text-xs text-base-content/50">
    <template v-if="store.loading && store.conversationsByRecentActivity.length">Loading…</template>
    <template v-else-if="store.error && store.nextCursor">
      <span class="text-error">Couldn't load more.</span>
      <button type="button" class="link ml-1" @click="store.fetchNextPage">Retry</button>
    </template>
  </div>
</template>
