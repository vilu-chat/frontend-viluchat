<script setup lang="ts">
import { Users } from '@lucide/vue'
import { useNewGroupDialog } from '@/composables/useNewGroupDialog'
import NewGroupDialog from '@/components/groups/NewGroupDialog.vue'

const newGroupDialog = useNewGroupDialog()
</script>

<template>
  <div class="flex flex-1 flex-col items-center justify-center gap-3 bg-chat text-base-content/50">
    <Users class="size-10 opacity-60" aria-hidden="true" />
    <p>Pick a group from the list, or start a new one.</p>
    <button type="button" class="ui-btn ui-btn-primary" @click="newGroupDialog.open">New group</button>
    <NewGroupDialog />
  </div>
</template>
