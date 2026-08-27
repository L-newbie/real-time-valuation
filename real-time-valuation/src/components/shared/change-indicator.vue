<template>
  <span :class="[directionClass, 'font-number inline-flex items-center', hideArrow ? '' : 'gap-1']">
    <span v-if="direction === 'rise' && !hideArrow" class="text-xs">▲</span>
    <span v-else-if="direction === 'fall' && !hideArrow" class="text-xs">▼</span>
    <span v-else-if="!hideArrow" class="text-xs opacity-40">◆</span>
    <span>{{ displayValue }}</span>
  </span>
</template>
<script setup lang="ts">

import { computed } from 'vue'
import { formatChangeRate, formatMoney } from '@/shared/utils/money-format'

const props = defineProps<{
  value: number | null | undefined

  type?: 'rate' | 'money'

  hideArrow?: boolean
}>()

const direction = computed(() => {
  if (props.value == null) return 'flat'
  if (props.value > 0) return 'rise'
  if (props.value < 0) return 'fall'
  return 'flat'
})

const directionClass = computed(() => {
  switch (direction.value) {
    case 'rise': return 'text-rise'
    case 'fall': return 'text-fall'
    default: return 'text-flat'
  }
})

const displayValue = computed(() => {
  if (props.value == null) return '--'
  switch (props.type ?? 'rate') {
    case 'money': return formatMoney(props.value)
    default: return formatChangeRate(props.value)
  }
})
</script>
