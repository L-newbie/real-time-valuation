<template>
  <CardBlock
    v-if="mode === 'collapse'"
    :title="title"
    :open="open"
    :summary="summary"
    @update:open="emit('update:open', $event)"
  >
    <slot />
  </CardBlock>
  <div v-else-if="active" class="pane-body">
    <slot />
  </div>
</template>
<script setup lang="ts">
import CardBlock from '@/components/fund-list/card-block.vue'

defineProps<{
  mode: 'collapse' | 'pane'
  title: string
  open: boolean
  active: boolean

  summary?: string
}>()

const emit = defineEmits<{ 'update:open': [v: boolean] }>()
</script>
<style scoped>
.pane-body {
  padding: var(--spacing-md);
  animation: pane-in var(--duration-fast) var(--ease-out-expo);
}

@keyframes pane-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

</style>
