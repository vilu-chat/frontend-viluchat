import { ref } from 'vue'

// Module-level so the sidebar's "+" button and GroupsView share the same dialog.
const isOpen = ref(false)

export function useNewGroupDialog() {
  return {
    isOpen,
    open: () => (isOpen.value = true),
    close: () => (isOpen.value = false),
  }
}
