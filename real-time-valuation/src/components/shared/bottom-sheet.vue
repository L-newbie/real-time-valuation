<template>
  <Teleport to="body">
    <Transition name="sheet-mask">
      <div
        v-if="visible"
        class="sheet-mask"
        @click="onMaskClick"
      />
    </Transition>
    <Transition :name="centered ? 'sheet-center' : 'sheet'">
      <div
        v-if="visible"
        ref="panelRef"
        class="sheet-panel"
        :class="{ 'sheet-panel-center': centered, 'sheet-panel-roomy': roomy }"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
        :style="dragStyle"
      >
        <div
          v-if="!centered"
          class="sheet-handle-zone"
          @pointerdown="onDragStart"
          @pointermove="onDragMove"
          @pointerup="onDragEnd"
          @pointercancel="onDragEnd"
        >
          <div class="sheet-handle" />
        </div>
        <header v-if="title || $slots.header" class="sheet-header">
          <slot name="header">
            <h3 class="sheet-title">{{ title }}</h3>
          </slot>
        </header>
        <div class="sheet-body">
          <slot />
        </div>
        <footer v-if="$slots.footer" class="sheet-footer">
          <slot name="footer" />
        </footer>
      </div>
    </Transition>
  </Teleport>
</template>
<script setup lang="ts">
import { ref, watch, computed, onUnmounted } from 'vue'
import { useLayoutMode } from '@/components/layout/use-layout-mode'

const props = withDefaults(defineProps<{
  visible: boolean
  title?: string

  maskClosable?: boolean

  center?: boolean

  roomy?: boolean
}>(), {
  title: '',
  maskClosable: true,
  center: undefined,
  roomy: false,
})

const emit = defineEmits<{ 'update:visible': [v: boolean] }>()

const { isWide } = useLayoutMode()

const centered = computed(() => props.center ?? isWide.value)
const panelRef = ref<HTMLElement | null>(null)

function close(): void { emit('update:visible', false) }
function onMaskClick(): void { if (props.maskClosable) close() }

const dragY = ref(0)
const dragging = ref(false)
let startY = 0
const CLOSE_THRESHOLD = 90

const dragStyle = computed(() => {
  if (!dragging.value || dragY.value <= 0) return undefined
  return {
    transform: `translate3d(0, ${dragY.value}px, 0)`,
    transition: 'none',
  }
})

function onDragStart(e: PointerEvent): void {
  dragging.value = true
  startY = e.clientY
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}
function onDragMove(e: PointerEvent): void {
  if (!dragging.value) return

  dragY.value = Math.max(0, e.clientY - startY)
}
function onDragEnd(): void {
  if (!dragging.value) return
  const shouldClose = dragY.value > CLOSE_THRESHOLD
  dragging.value = false
  dragY.value = 0
  if (shouldClose) close()
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') close()
}

watch(() => props.visible, (v) => {
  if (v) {
    document.addEventListener('keydown', onKeydown)
    document.body.style.overscrollBehavior = 'none'
  } else {
    document.removeEventListener('keydown', onKeydown)
    document.body.style.overscrollBehavior = ''

    dragging.value = false
    dragY.value = 0
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overscrollBehavior = ''
})
</script>
<style scoped>
.sheet-mask {
  position: fixed;
  inset: 0;
  background: var(--mask-bg, rgba(0, 0, 0, 0.55));
  backdrop-filter: blur(14px) saturate(130%);
  -webkit-backdrop-filter: blur(14px) saturate(130%);
  z-index: var(--z-overlay);
}

.sheet-panel {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: var(--z-modal);
  display: flex;
  flex-direction: column;
  max-height: 88dvh;

  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  will-change: transform;

  background: transparent;
}

.sheet-panel-center {
  left: 50%;
  right: auto;
  bottom: auto;
  top: 50%;
  transform: translate(-50%, -50%);
  width: min(420px, calc(100vw - 48px));
  max-height: 82dvh;
  border-radius: var(--radius-2xl);
  padding-bottom: 0;

  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur)) saturate(150%);
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(150%);
  box-shadow: var(--shadow-xl);
}

.sheet-panel-center.sheet-panel-roomy {
  width: min(560px, calc(100vw - 48px));
  max-height: 88dvh;
}

@media (min-width: 1024px) {
  .sheet-panel-center.sheet-panel-roomy {
    min-height: min(600px, 78dvh);
  }
  .sheet-panel-center.sheet-panel-roomy .sheet-body > * {
    min-height: 100%;
  }
}

.sheet-handle-zone {
  display: flex;
  justify-content: center;
  padding: var(--spacing-sm) 0 var(--spacing-xs);
  cursor: grab;
  touch-action: none;
  flex-shrink: 0;
}
.sheet-handle-zone:active { cursor: grabbing; }
.sheet-handle {
  width: 38px;
  height: 4px;
  border-radius: var(--radius-full);
  background: var(--border-hover);
}

.sheet-header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--spacing-md);
  padding: var(--spacing-sm) var(--spacing-lg) var(--spacing-md);
  flex-shrink: 0;

  min-height: 34px;
}
.sheet-panel-center .sheet-header {
  padding-top: var(--spacing-lg);
}
.sheet-panel-roomy .sheet-header {
  padding: var(--spacing-lg) var(--spacing-lg) var(--spacing-lg);
  min-height: 44px;
}
.sheet-panel-center.sheet-panel-roomy .sheet-header {
  padding-top: var(--spacing-xl);
}

.sheet-title {
  position: absolute;
  left: var(--spacing-2xl);
  right: var(--spacing-2xl);
  text-align: center;
  font-size: var(--font-lg);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  pointer-events: none;
}

.sheet-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 var(--spacing-lg) var(--spacing-lg);
  overscroll-behavior: contain;
}

.sheet-panel-roomy .sheet-body {
  padding-top: var(--spacing-sm);
}

.sheet-footer {
  flex-shrink: 0;
  display: flex;
  gap: var(--spacing-sm);
  padding: var(--spacing-md) var(--spacing-lg);
}
.sheet-panel-center .sheet-footer {
  padding-bottom: var(--spacing-lg);
}

.sheet-center-enter-active {
  transition: opacity var(--duration-fast) var(--ease-out-expo),
              transform var(--duration-fast) var(--ease-out-expo);
}
.sheet-center-leave-active {
  transition: opacity var(--duration-micro) var(--ease-smooth),
              transform var(--duration-micro) var(--ease-smooth);
}
.sheet-center-enter-from,
.sheet-center-leave-to {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.96);
}
</style>
