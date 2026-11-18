import { ref } from 'vue'

/** Module-level state, so every component that calls the returned composable shares one dialog. */
export function createDialogState() {
  const isOpen = ref(false)

  return () => ({
    isOpen,
    open: () => (isOpen.value = true),
    close: () => (isOpen.value = false),
  })
}
