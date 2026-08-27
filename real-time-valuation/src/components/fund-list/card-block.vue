<template>
  <div class="card-block" :class="{ 'is-open': open }">
    <button
      type="button"
      class="block-head"
      :aria-expanded="open"
      @click.stop="toggle"
      @touchstart.stop
      @mousedown.stop
    >
      <span class="block-title">{{ title }}</span>
      <span v-if="!open && summary" class="block-summary">{{ summary }}</span>
      <span class="block-arrow" aria-hidden="true">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </span>
    </button>
    <div class="block-wrap" :class="{ 'is-animating': animating }">
      <div
        class="block-body"
        @click.stop
        @touchstart.stop
        @touchmove.stop
        @touchend.stop
        @mousedown.stop
        @mouseup.stop
      >
        <div class="block-inner">
          <slot />
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'

const props = defineProps<{
  title: string
  open: boolean

  summary?: string
}>()

const emit = defineEmits<{ 'update:open': [v: boolean] }>()

// will-change 只在动画期间挂：常驻会让每张卡都长期占一层合成层，
// 卡片多了反而更卡。淡入结束后靠定时器兜底摘掉。
const animating = ref(false)
let settleTimer: ReturnType<typeof setTimeout> | null = null

const SETTLE_FALLBACK_MS = 500

watch(() => props.open, () => {
  animating.value = true
  if (settleTimer) clearTimeout(settleTimer)
  settleTimer = setTimeout(() => { animating.value = false }, SETTLE_FALLBACK_MS)
})

onUnmounted(() => {
  if (settleTimer) clearTimeout(settleTimer)
})

function toggle(): void {
  emit('update:open', !props.open)
}
</script>
<style scoped>
.card-block {
  border-top: 1px solid var(--border-subtle);
}

.block-head {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  text-align: left;
  transition: color var(--transition-fast), background-color var(--transition-fast);
}
.block-head:hover {
  color: var(--text-primary);
  background: var(--border-subtle);
}

.block-head::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  width: 3px;
  height: 0;
  border-radius: 0 2px 2px 0;
  background: var(--color-primary);
  transform: translateY(-50%);
  transition: height var(--duration-fast) var(--ease-out-expo);
}

.is-open .block-head {
  background: var(--color-primary-glow);
  color: var(--color-primary-light);
}
.is-open .block-head:hover { background: var(--color-primary-glow); }
.is-open .block-head::before { height: 62%; }
.is-open .block-title { font-weight: 700; }
.is-open .block-arrow { color: inherit; }

.block-title {
  font-size: var(--font-xs);
  font-weight: 600;
  letter-spacing: 0.02em;
}

.block-summary {
  margin-left: auto;
  font-size: var(--font-xs);
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.block-arrow {
  display: inline-flex;
  color: var(--text-muted);
  transition: transform var(--duration-fast) var(--ease-out-expo);
  flex-shrink: 0;
}

.block-title + .block-arrow { margin-left: auto; }
.is-open .block-arrow { transform: rotate(180deg); }

.block-wrap {
  display: grid;
  grid-template-rows: 0fr;
  contain: layout paint;
}
.is-open .block-wrap { grid-template-rows: 1fr; }

.block-body {
  overflow: hidden;
  min-height: 0;
  contain: layout paint;
}
.block-inner {
  padding: 0 var(--spacing-md) var(--spacing-md);
  opacity: 0;
  transform: translate3d(0, -4px, 0);
  transition: opacity var(--duration-fast) var(--ease-out-expo),
              transform var(--duration-fast) var(--ease-out-expo);
}
.is-open .block-inner {
  opacity: 1;
  transform: none;
  transition-delay: 60ms;
}

.block-wrap.is-animating .block-inner {
  will-change: opacity, transform;
}

</style>
