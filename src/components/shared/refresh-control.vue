<template>
  <div class="rc" ref="rootEl">
    <button
      type="button"
      class="rc-trigger"
      :class="{ off: !autoRefresh, open: menuOpen }"
      :title="autoRefresh ? `每 ${interval}s 自动刷新` : '自动刷新已关闭'"
      @click.stop="menuOpen = !menuOpen"
    >
      <svg class="rc-icon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="23 4 23 10 17 10" />
        <path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10" />
      </svg>
      <span class="rc-label font-number">{{ autoRefresh ? `${interval}s` : '关' }}</span>
      <svg class="rc-caret" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>
    <Transition name="rc-pop">
      <div v-if="menuOpen" class="rc-menu" @click.stop>
        <button
          type="button"
          class="rc-item"
          :class="{ on: !autoRefresh }"
          @click="pick(null)"
        >
          <span>关闭</span>
          <span v-if="!autoRefresh" class="rc-check">✓</span>
        </button>
        <button
          v-for="o in options"
          :key="o"
          type="button"
          class="rc-item"
          :class="{ on: autoRefresh && interval === o }"
          @click="pick(o)"
        >
          <span class="font-number">{{ o }}s</span>
          <span v-if="autoRefresh && interval === o" class="rc-check">✓</span>
        </button>
      </div>
    </Transition>
  </div>
</template>
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useSettingsStore, type RefreshIntervalOption } from '@/modules/settings/settings-store'

const props = defineProps<{
  toggleKey: 'autoRefresh' | 'marketAutoRefresh' | 'sectorAutoRefresh' | 'newsAutoRefresh'

  intervalKey: 'refreshInterval' | 'marketRefreshInterval' | 'sectorRefreshInterval' | 'newsRefreshInterval'

  options: readonly number[]
}>()

const settingsStore = useSettingsStore()
const rootEl = ref<HTMLElement | null>(null)
const menuOpen = ref(false)

const autoRefresh = computed(() => settingsStore[props.toggleKey])
const interval = computed(() => settingsStore[props.intervalKey])

function pick(seconds: number | null): void {
  if (seconds == null) {
    settingsStore[props.toggleKey] = false
  } else {
    settingsStore[props.intervalKey] = seconds as RefreshIntervalOption
    settingsStore[props.toggleKey] = true
  }
  menuOpen.value = false
}

function onDocClick(e: MouseEvent): void {
  if (!menuOpen.value) return
  if (rootEl.value?.contains(e.target as Node)) return
  menuOpen.value = false
}

onMounted(() => document.addEventListener('click', onDocClick, true))
onUnmounted(() => document.removeEventListener('click', onDocClick, true))
</script>
<style scoped>
.rc {
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
}

.rc-trigger {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  padding: 0 6px;
  border-radius: var(--radius-full);
  border: 1px solid var(--color-primary);
  background: var(--color-primary-glow);
  color: var(--color-primary);
  font-family: inherit;
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
  transition: background-color var(--transition-fast),
              border-color var(--transition-fast),
              color var(--transition-fast);
}
.rc-trigger:hover { background: var(--color-primary); color: var(--color-on-primary); }
.rc-trigger.off {
  border-color: var(--border-default);
  background: var(--bg-elevated);
  color: var(--text-muted);
}
.rc-trigger.off:hover { border-color: var(--border-hover); color: var(--text-secondary); background: var(--bg-card-hover); }

.rc-icon { flex-shrink: 0; }
.rc-label { font-variant-numeric: tabular-nums; }
.rc-caret {
  flex-shrink: 0;
  opacity: 0.7;
  transition: transform var(--transition-fast);
}
.rc-trigger.open .rc-caret { transform: rotate(180deg); }

.rc-menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  z-index: 200;
  min-width: 84px;
  padding: 3px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
  background: var(--bg-elevated);
  box-shadow: var(--shadow-lg);
}

.rc-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
  width: 100%;
  padding: 5px 8px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  font-family: inherit;
  font-size: 11px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  transition: background-color var(--transition-fast), color var(--transition-fast);
}
.rc-item:hover { background: var(--bg-card-hover); color: var(--text-primary); }
.rc-item.on { color: var(--color-primary); }
.rc-check { font-size: 10px; }

.rc-pop-enter-active {
  transition: opacity var(--duration-micro) var(--ease-out-expo),
              transform var(--duration-fast) var(--ease-spring);
  transform-origin: top right;
}
.rc-pop-leave-active {
  transition: opacity 140ms var(--ease-smooth),
              transform 140ms var(--ease-smooth);
  transform-origin: top right;
}
.rc-pop-enter-from,
.rc-pop-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.94);
}
</style>
