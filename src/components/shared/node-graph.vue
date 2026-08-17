<template>
  <div ref="rootEl" class="ng" :style="{ height: `${height}px` }">
    <svg
      v-if="expanded"
      class="ng-links"
      :viewBox="`0 0 ${size.w} ${size.h}`"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        v-for="(n, i) in laidOut"
        :key="`link-${n.id}`"
        :d="linkPath(n)"
        class="ng-link"
        :style="{ animationDelay: `${i * 55}ms` }"
      />
    </svg>
    <span
      v-if="expanded"
      :key="`pulse-${centerNode.id}`"
      class="ng-pulse"
      :style="centerStyle"
      aria-hidden="true"
    />
    <button
      class="ng-node ng-center"
      :class="{ 'is-large': !expanded }"
      :style="centerStyle"
      :title="centerTitle"
      @click="onCenterClick"
    >
      <slot name="center" :node="centerNode" :expanded="expanded" :is-root="path.length === 0">
        <span class="ng-chip ng-chip-center">{{ centerNode.label }}</span>
      </slot>
      <span v-if="expanded && path.length > 0" class="ng-center-back" aria-hidden="true">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </span>
    </button>
    <template v-if="expanded">
      <button
        v-for="n in laidOut"
        :key="`${centerNode.id}-${n.id}`"
        class="ng-node ng-child"
        :class="{ 'is-disabled': n.disabled }"
        :style="n.style"
        :title="n.disabled ? `${n.label}（未开放）` : (n.desc || n.label)"
        :disabled="n.disabled"
        @click="onPick(n)"
      >
        <span class="ng-chip" :class="[`tone-${n.tone || 'plain'}`, { 'is-selected': n.selected }]">
          <span v-if="n.icon" class="ng-chip-icon" v-html="n.icon" />
          <span class="ng-chip-text">
            <span class="ng-chip-label">{{ n.label }}</span>
            <span v-if="n.value" class="ng-chip-value font-number" :class="n.valueTone">{{ n.value }}</span>
            <span v-else-if="n.desc" class="ng-chip-desc">{{ n.desc }}</span>
          </span>
          <span v-if="n.selected" class="ng-chip-check" aria-hidden="true">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </span>
          <span v-else-if="n.children?.length" class="ng-chip-more" aria-hidden="true" />
        </span>
      </button>
    </template>
  </div>
</template>
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'

export interface GraphNode {
  id: string
  label: string
  desc?: string
  value?: string

  valueTone?: string
  tone?: 'plain' | 'accent' | 'mint'
  icon?: string

  path?: string

  disabled?: boolean

  selected?: boolean
  children?: GraphNode[]
}

const props = withDefaults(defineProps<{
  root: GraphNode
  height?: number
}>(), {
  height: 360,
})

const emit = defineEmits<{
  activate: [node: GraphNode]
}>()

const rootEl = ref<HTMLElement | null>(null)
const size = ref({ w: 360, h: 360 })

const expanded = ref(false)

const path = ref<string[]>([])

const centerNode = computed<GraphNode>(() => {
  let cur = props.root
  for (const id of path.value) {
    const next = cur.children?.find(c => c.id === id)
    if (!next) break
    cur = next
  }
  return cur
})

const stack = computed<GraphNode[]>(() => {
  const out: GraphNode[] = []
  let cur = props.root
  for (const id of path.value) {
    out.push(cur)
    const next = cur.children?.find(c => c.id === id)
    if (!next) break
    cur = next
  }
  return out
})

const children = computed(() => centerNode.value.children ?? [])

const centerTitle = computed(() => {
  if (!expanded.value) return '展开'
  return stack.value.length > 0 ? `返回 ${stack.value[stack.value.length - 1].label}` : '收起'
})

const laidOut = computed(() => {
  const list = children.value
  const n = list.length
  if (n === 0) return []
  const cx = size.value.w / 2
  const cy = size.value.h / 2

  const ratio = n >= 5 ? 0.42 : 0.38
  const r = Math.min(size.value.w, size.value.h) * ratio
  return list.map((node, i) => {
    const angle = (-90 + (360 / n) * i) * (Math.PI / 180)
    return {
      ...node,
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
      style: {
        left: `${cx + Math.cos(angle) * r}px`,
        top: `${cy + Math.sin(angle) * r}px`,

        '--from-x': `${-Math.cos(angle) * r}px`,
        '--from-y': `${-Math.sin(angle) * r}px`,
        animationDelay: `${i * 55}ms`,
      },
    }
  })
})

const centerStyle = computed(() => ({
  left: `${size.value.w / 2}px`,
  top: `${size.value.h / 2}px`,
}))

function linkPath(n: { x: number; y: number }): string {
  const cx = size.value.w / 2
  const cy = size.value.h / 2
  const dx = n.x - cx
  const dy = n.y - cy
  const len = Math.hypot(dx, dy) || 1
  const off = len * 0.12
  const ctrlX = (cx + n.x) / 2 - (dy / len) * off
  const ctrlY = (cy + n.y) / 2 + (dx / len) * off
  return `M ${cx} ${cy} Q ${ctrlX} ${ctrlY} ${n.x} ${n.y}`
}

function onCenterClick(): void {
  if (!expanded.value) {
    expanded.value = true
    return
  }
  if (path.value.length > 0) {
    path.value = path.value.slice(0, -1)
    return
  }
  expanded.value = false
}

function onPick(n: GraphNode): void {
  if (n.disabled) return
  if (n.children?.length) {
    path.value = [...path.value, n.id]
  } else {
    emit('activate', n)
  }
}

function reset(): void {
  path.value = []
  expanded.value = false
}
defineExpose({ reset })

function measure(): void {
  const el = rootEl.value
  if (!el) return
  const r = el.getBoundingClientRect()
  if (r.width > 0) size.value = { w: r.width, h: r.height }
}

let ro: ResizeObserver | null = null
onMounted(() => {
  void nextTick(measure)
  ro = new ResizeObserver(measure)
  if (rootEl.value) ro.observe(rootEl.value)
})
onUnmounted(() => { ro?.disconnect(); ro = null })
</script>
<style scoped>
.ng {
  position: relative;
  width: 100%;

  overflow: visible;
  border-radius: var(--radius-lg);
}

.ng::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background-image: radial-gradient(circle, var(--border-subtle) 1px, transparent 1px);
  background-size: 22px 22px;
  pointer-events: none;
  z-index: 0;
}

.ng-links {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: visible;
}
@keyframes ngFade { from { opacity: 0; } to { opacity: 1; } }

.ng-link {
  fill: none;
  stroke: var(--color-primary);
  stroke-width: 1.2;
  stroke-linecap: round;
  opacity: 0.55;
  stroke-dasharray: 400;
  stroke-dashoffset: 400;
  animation: ngDraw var(--duration-slow) var(--ease-out-expo) both;
}
@keyframes ngDraw {
  0%   { stroke-dashoffset: 400; opacity: 0; }
  100% { stroke-dashoffset: 0;   opacity: 0.55; }
}

.ng-node {
  position: absolute;
  transform: translate(-50%, -50%);
  border: none;
  background: transparent;
  padding: 0;
  z-index: 2;
}

.ng-pulse {
  position: absolute;
  width: 10px;
  height: 10px;
  margin: -5px 0 0 -5px;
  border-radius: 50%;
  border: 1px solid var(--color-primary);
  pointer-events: none;
  z-index: 1;
  animation: ngPulse 900ms var(--ease-out-expo) both;
}
@keyframes ngPulse {
  0%   { transform: scale(1);  opacity: 0.9; }
  100% { transform: scale(34); opacity: 0; }
}

.ng-center {
  z-index: 4;
  cursor: pointer;

  display: flex;
  align-items: center;
  justify-content: center;

  transition: transform var(--duration-slow) var(--ease-out-expo);
  will-change: transform;
}
.ng-center.is-large { transform: translate(-50%, -50%) scale(1.35); }

.ng-center-back {
  position: absolute;
  left: -6px;
  top: -6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: var(--radius-full);
  background: var(--color-primary);
  color: var(--color-on-primary);
  box-shadow: var(--shadow-md);
  pointer-events: none;
}

.ng-child {
  cursor: pointer;

  animation: ngBurst var(--duration-slow) var(--ease-spring) both;
}
@keyframes ngBurst {
  0% {
    opacity: 0;

    transform: translate(-50%, -50%) translate(var(--from-x), var(--from-y)) scale(0.4);
    filter: blur(6px);
  }
  60% { opacity: 1; }
  100% {
    opacity: 1;
    transform: translate(-50%, -50%) translate(0, 0) scale(1);
    filter: blur(0);
  }
}

.ng-chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 12px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-default);
  background: var(--bg-card);
  white-space: nowrap;
  position: relative;
  transition: background-color var(--transition-fast), border-color var(--transition-fast),
              transform var(--transition-fast);
}
.ng-child:hover .ng-chip {
  background: var(--bg-card-hover);
  border-color: var(--border-hover);
  transform: translateY(-1px);
}
.ng-child:active .ng-chip { transform: scale(0.97); }

.ng-child.is-disabled { cursor: not-allowed; }
.ng-child.is-disabled .ng-chip {
  opacity: 0.42;
  background: var(--bg-surface);
}
.ng-child.is-disabled:hover .ng-chip { transform: none; border-color: var(--border-default); }

.ng-chip-icon { display: inline-flex; flex-shrink: 0; color: var(--text-secondary); }

.ng-chip-text { display: flex; flex-direction: column; gap: 1px; min-width: 0; text-align: left; }
.ng-chip-label { font-size: var(--font-xs); font-weight: 600; color: var(--text-primary); }
.ng-chip-desc { font-size: 10px; color: var(--text-muted); }
.ng-chip-value {
  font-size: var(--font-sm);
  font-weight: 700;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
  line-height: 1.15;
}

.ng-chip.is-selected {
  border-color: var(--color-primary);
  background: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-glow);
}
.ng-chip.is-selected .ng-chip-label,
.ng-chip.is-selected .ng-chip-value,
.ng-chip.is-selected .ng-chip-desc,
.ng-chip.is-selected .ng-chip-icon { color: var(--color-on-primary); }
.ng-child:hover .ng-chip.is-selected { background: var(--color-primary-light); }

.ng-chip-check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background: var(--color-on-primary);
  color: var(--color-primary);
  flex-shrink: 0;
}

.ng-chip-more {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--color-primary);
}

@media (max-width: 767px) {
  .ng-chip { padding: 6px 10px; gap: 6px; }
  .ng-chip-label { font-size: 11px; }
  .ng-chip-value { font-size: var(--font-xs); }
  .ng-center.is-large { transform: translate(-50%, -50%) scale(1.2); }
}

</style>
