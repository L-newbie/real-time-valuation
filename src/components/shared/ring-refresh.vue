<template>
  <button
    class="rr"
    :class="{ spinning }"
    :disabled="spinning"
    :title="spinning ? '刷新中' : enabled ? `每 ${interval}s 自动刷新，点击立即刷新` : '自动刷新已关闭，点击立即刷新'"
    @click="$emit('refresh')"
  >
    <svg class="rr-ring" :width="size" :height="size" viewBox="0 0 26 26">
      <circle cx="13" cy="13" r="10" fill="none" stroke="var(--border-default)" stroke-width="2" />
      <circle
        v-if="ghost"
        class="rr-ghost"
        cx="13" cy="13" r="10"
        fill="none"
        stroke="var(--color-primary)"
        stroke-width="2"
        stroke-linecap="round"
        transform="rotate(-90 13 13)"
        stroke-dashoffset="0"
      />
      <circle
        class="rr-progress"
        :class="{ clearing }"
        cx="13" cy="13" r="10"
        fill="none"
        stroke="var(--color-primary)"
        stroke-width="2"
        stroke-linecap="round"
        transform="rotate(-90 13 13)"
        :stroke-dashoffset="dashOffset"
      />
    </svg>
    <svg class="rr-icon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10" />
    </svg>
  </button>
</template>
<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from 'vue'

const props = withDefaults(defineProps<{
  interval: number

  countdown?: number

  enabled?: boolean

  spinning?: boolean
  size?: number
}>(), {
  enabled: true,
  spinning: false,
  size: 26,
})

defineEmits<{ refresh: [] }>()

const CIRCUMFERENCE = 62.83

const dashOffset = computed(() => {
  if (!props.enabled) return CIRCUMFERENCE
  if (props.countdown == null || props.interval <= 0) return 0
  const elapsed = props.interval - props.countdown
  const ratio = Math.min(1, Math.max(0, elapsed / props.interval))
  return CIRCUMFERENCE * (1 - ratio)
})

const clearing = ref(false)
const ghost = ref(false)
let prevOffset = dashOffset.value
let ghostTimer: ReturnType<typeof setTimeout> | null = null

const GHOST_FADE_MS = 620

watch(dashOffset, (next) => {
  if (next > prevOffset + 0.5) {
    clearing.value = true
    if (props.enabled && prevOffset < CIRCUMFERENCE * 0.12) {
      ghost.value = false
      requestAnimationFrame(() => { ghost.value = true })
      if (ghostTimer) clearTimeout(ghostTimer)
      ghostTimer = setTimeout(() => { ghost.value = false }, GHOST_FADE_MS)
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => { clearing.value = false })
    })
  }
  prevOffset = next
})

onUnmounted(() => { if (ghostTimer) clearTimeout(ghostTimer) })
</script>
<style scoped>
.rr {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: color var(--transition-fast);
}
.rr:hover { color: var(--text-primary); }
.rr:disabled { cursor: not-allowed; }

.rr-ring {
  position: absolute;
  inset: 2px;

  transform-origin: 50% 50%;
}

.rr-progress {
  stroke-dasharray: 62.83;
  transition: stroke-dashoffset 1s linear;
}
.rr-progress.clearing { transition: none; }

.rr-ghost {
  stroke-dasharray: 62.83;
  pointer-events: none;
  transform-origin: 50% 50%;
  animation: rrGhostOut 620ms var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1)) forwards;
}
@keyframes rrGhostOut {
  from { opacity: 0.85; }
  to { opacity: 0; }
}

.rr-icon { position: relative; z-index: 1; }

.rr.spinning .rr-ring { animation: rrSpin 0.9s linear infinite; }
.rr.spinning .rr-icon { animation: rrSpin 0.9s linear infinite; transform-origin: 50% 50%; }
.rr.spinning .rr-progress { transition: none; opacity: 0.55; }
@keyframes rrSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
</style>
