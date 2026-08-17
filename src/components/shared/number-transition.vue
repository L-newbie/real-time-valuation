<template>
  <span :class="['font-number', pulseClass]">{{ formattedValue }}</span>
</template>
<script setup lang="ts">

import { ref, watch, computed } from 'vue'
import { formatMoney, formatChangeRate, formatNetValue, formatCompactMoney, formatProfitCompact } from '@/shared/utils/money-format'

const props = defineProps<{
  value: number

  type?: 'money' | 'rate' | 'netValue' | 'compactMoney' | 'compactProfit'
}>()

const pulseClass = ref('')

const formattedValue = computed(() => {
  switch (props.type ?? 'money') {
    case 'rate': return formatChangeRate(props.value)
    case 'netValue': return formatNetValue(props.value)
    case 'compactMoney': return `¥${formatCompactMoney(props.value)}`
    case 'compactProfit': return formatProfitCompact(props.value)
    default: return formatMoney(props.value)
  }
})

watch(() => props.value, () => {
  pulseClass.value = 'animate-pulse-number'
  setTimeout(() => { pulseClass.value = '' }, 400)
})
</script>
