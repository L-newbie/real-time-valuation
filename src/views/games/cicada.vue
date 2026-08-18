<template>
  <div class="cicada-page">
    <canvas ref="canvasRef" class="cicada-canvas" :class="{ holding: holding }"></canvas>
    <div class="topbar">
      <button class="btn-back" @click="goBack" title="返回">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        <span>返回</span>
      </button>
      <span class="title">竹知了</span>
      <span class="rps font-number">{{ rpsText }} 圈/秒</span>
    </div>
    <div class="hint" :class="{ gone: hintGone }">按住屏幕画圈，甩起来就叫</div>
    <div class="bottombar">
      <button class="btn-auto" :class="{ on: autoOn }" @click="toggleAuto">
        {{ autoOn ? '停一停' : '自动甩' }}
      </button>
    </div>
    <button v-if="showUnlock" class="unlock" @click="unlockAudio">点一下开声音</button>
  </div>
</template>
<script setup lang="ts">

import { ref, onMounted, onUnmounted, onActivated, onDeactivated } from 'vue'
import { useRouter } from 'vue-router'

import {
  createToyState, resizeToy, updateToy, clamp,
} from '@/modules/game/cicada/cicada-physics'
import {
  ensureAudio, updateAudio, triggerSample, setPlayingProbe,
  suspendAudio, isAudioRunning, disposeAudio,
} from '@/modules/game/cicada/cicada-audio'
import { createRenderer, type Renderer } from '@/modules/game/cicada/cicada-render'

defineOptions({ name: 'CicadaGame' })

const router = useRouter()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const holding = ref(false)
const autoOn = ref(false)
const hintGone = ref(false)
const showUnlock = ref(false)
const rpsText = ref('0.0')

const toy = createToyState()

const pointer = { down: false, id: null as number | null, lift: 0 }

let renderer: Renderer | null = null
let rafId = 0
let last = 0
let hudTimer = 0
let singTime = 0

let stopped = false

function applySize(): void {
  const cv = canvasRef.value
  if (!cv) return
  const W = cv.clientWidth
  const H = cv.clientHeight

  if (!(W > 0 && H > 0)) return
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  cv.width = W * dpr
  cv.height = H * dpr
  const ctx = cv.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  resizeToy(toy, W, H)
  renderer?.resize(W, H, dpr)
}

function frame(nowMs: number): void {
  if (stopped) return
  const cv = canvasRef.value

  if (cv && (cv.clientWidth !== toy.W || cv.clientHeight !== toy.H)) applySize()

  const dt = Math.min(0.05, (nowMs - last) / 1000) || 0.016
  last = nowMs

  updateToy(toy, dt)

  if (toy.active < 0.02 && toy.rps < 0.15 && !pointer.down && !toy.auto.on) {
    toy.idleTime += dt
    if (toy.idleTime > 8) suspendAudio()
  } else {
    toy.idleTime = 0
  }

  updateAudio(toy)
  renderer?.draw(toy, nowMs / 1000, dt)

  if (toy.active > 0.3) {
    singTime += dt
    if (!hintGone.value && singTime > 1.0) hintGone.value = true
  }

  hudTimer -= dt
  if (hudTimer <= 0) {
    hudTimer = 0.15
    rpsText.value = toy.rps.toFixed(1)
    showUnlock.value = wantSound() && !isAudioRunning()
  }

  rafId = requestAnimationFrame(frame)
}

function wantSound(): boolean {
  return pointer.down || toy.auto.on || toy.active > 0.05
}

function onPointerDown(e: PointerEvent): void {
  if (pointer.down) return
  pointer.down = true
  pointer.id = e.pointerId

  pointer.lift = e.pointerType === 'touch' ? Math.min(110, toy.ropeLen * 0.9) : 0
  toy.interacted = true
  holding.value = true
  if (toy.auto.on) setAuto(false)

  const cv = canvasRef.value
  cv?.setPointerCapture(e.pointerId)
  const rect = cv?.getBoundingClientRect()
  const ox = rect?.left ?? 0
  const oy = rect?.top ?? 0
  toy.target.x = e.clientX - ox
  toy.target.y = Math.max(12, e.clientY - oy - pointer.lift)

  ensureAudio(true)
  triggerSample()
}

function onPointerMove(e: PointerEvent): void {
  if (!pointer.down || e.pointerId !== pointer.id) return
  const rect = canvasRef.value?.getBoundingClientRect()
  const ox = rect?.left ?? 0
  const oy = rect?.top ?? 0
  toy.target.x = e.clientX - ox
  toy.target.y = Math.max(12, e.clientY - oy - pointer.lift)
}

function onPointerUp(e: PointerEvent): void {
  if (pointer.down && e.pointerId !== pointer.id) return
  pointer.down = false
  pointer.id = null
  holding.value = false

  ensureAudio(true)
}

function setAuto(on: boolean): void {
  toy.auto.on = on
  autoOn.value = on
  if (on) {
    toy.interacted = true
    toy.auto.cx = clamp(toy.stick.x, toy.W * 0.28, toy.W * 0.72)
    toy.auto.cy = clamp(toy.stick.y, toy.H * 0.26, toy.H * 0.6)
    ensureAudio(true)
    triggerSample()
  }
}

function toggleAuto(): void {
  setAuto(!toy.auto.on)
}

function unlockAudio(): void {
  ensureAudio(true)
  triggerSample()
}

function onKeydown(e: KeyboardEvent): void {
  if (e.code === 'Space' && !e.repeat) {
    e.preventDefault()
    toggleAuto()
  }
}

function onVisibilityChange(): void {
  if (document.hidden) suspendAudio()
  else ensureAudio(false)
}

function goBack(): void {
  router.back()
}

onMounted(() => {
  const cv = canvasRef.value
  if (!cv) return
  const ctx = cv.getContext('2d')
  if (!ctx) return

  renderer = createRenderer(ctx)
  applySize()

  setPlayingProbe(() => pointer.down || toy.auto.on || toy.active > 0.02)

  cv.addEventListener('pointerdown', onPointerDown)
  cv.addEventListener('pointermove', onPointerMove)
  cv.addEventListener('pointerup', onPointerUp)
  cv.addEventListener('pointercancel', onPointerUp)
  window.addEventListener('resize', applySize)
  window.addEventListener('keydown', onKeydown)
  document.addEventListener('visibilitychange', onVisibilityChange)

  stopped = false
  last = performance.now()
  rafId = requestAnimationFrame(frame)
})

function teardownAudio(): void {
  toy.auto.on = false
  autoOn.value = false
  pointer.down = false
  pointer.id = null
  holding.value = false
  document.removeEventListener('visibilitychange', onVisibilityChange)
  disposeAudio()
}

onUnmounted(() => {
  stopped = true
  cancelAnimationFrame(rafId)
  const cv = canvasRef.value
  cv?.removeEventListener('pointerdown', onPointerDown)
  cv?.removeEventListener('pointermove', onPointerMove)
  cv?.removeEventListener('pointerup', onPointerUp)
  cv?.removeEventListener('pointercancel', onPointerUp)
  window.removeEventListener('resize', applySize)
  window.removeEventListener('keydown', onKeydown)
  teardownAudio()
  renderer?.dispose()
  renderer = null
})

onDeactivated(() => {
  stopped = true
  cancelAnimationFrame(rafId)

  teardownAudio()
})
onActivated(() => {
  if (!renderer) return
  document.addEventListener('visibilitychange', onVisibilityChange)
  stopped = false
  last = performance.now()
  rafId = requestAnimationFrame(frame)
})
</script>
<style scoped>
.cicada-page {
  position: relative;
  width: 100%;

  height: 100%;
  overflow: hidden;
  background: #0a1028;
}

.cicada-canvas {
  display: block;
  width: 100%;
  height: 100%;

  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  cursor: grab;
}
.cicada-canvas.holding { cursor: grabbing; }

.topbar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
  padding: calc(env(safe-area-inset-top, 0px) + 10px) var(--spacing-md) 10px;
  pointer-events: none;
}
.topbar .title {
  font-size: var(--font-md);
  font-weight: 700;
  color: rgba(255, 245, 225, 0.92);
  letter-spacing: 2px;
}
.topbar .rps {
  font-size: var(--font-xs);
  color: rgba(255, 245, 225, 0.55);
  min-width: 72px;
  text-align: right;
}
.btn-back {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 12px 5px 8px;
  border-radius: var(--radius-full);
  border: 1px solid rgba(255, 235, 205, 0.28);
  background: rgba(10, 16, 40, 0.45);
  color: rgba(255, 245, 225, 0.9);
  font-size: var(--font-xs);
  cursor: pointer;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  transition: all var(--transition-fast);
}
.btn-back:hover {
  border-color: rgba(255, 235, 205, 0.6);
  background: rgba(30, 40, 80, 0.6);
}

.hint {
  position: absolute;
  left: 50%;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 88px);
  transform: translateX(-50%);
  padding: 6px 16px;
  border-radius: var(--radius-full);
  background: rgba(10, 16, 40, 0.5);
  color: rgba(255, 240, 210, 0.8);
  font-size: var(--font-xs);
  white-space: nowrap;
  pointer-events: none;
  transition: opacity 0.6s ease;
}
.hint.gone { opacity: 0; }

.bottombar {
  position: absolute;
  left: 0;
  right: 0;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 24px);
  display: flex;
  justify-content: center;
  pointer-events: none;
}
.btn-auto {
  pointer-events: auto;
  padding: 9px 28px;
  border-radius: var(--radius-full);
  border: 1px solid rgba(255, 235, 205, 0.3);
  background: rgba(10, 16, 40, 0.5);
  color: rgba(255, 245, 225, 0.92);
  font-size: var(--font-sm);
  font-weight: 600;
  cursor: pointer;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  transition: all var(--transition-fast);
}
.btn-auto:hover { background: rgba(40, 50, 95, 0.65); }
.btn-auto.on {
  border-color: #d84a35;
  background: rgba(200, 60, 42, 0.55);
}

.unlock {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  padding: 10px 24px;
  border-radius: var(--radius-full);
  border: 1px solid rgba(255, 220, 170, 0.5);
  background: rgba(20, 28, 60, 0.8);
  color: #ffe9bd;
  font-size: var(--font-sm);
  cursor: pointer;
  animation: unlock-breathe 1.8s ease-in-out infinite;
}
@keyframes unlock-breathe {
  0%, 100% { opacity: 0.75; }
  50%      { opacity: 1; }
}
</style>
