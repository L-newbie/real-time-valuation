<template>
  <el-popover
    :visible="visible"
    placement="bottom-start"
    :width="220"
    :show-arrow="false"
    popper-class="privacy-popper"
    @update:visible="(val: boolean) => emit('update:visible', val)"
  >
    <template #reference>
      <button
        class="btn-eye"
        :class="eyeState"
        :title="eyeTitle"
        @click="emit('update:visible', !visible)"
      >
        <svg v-if="privacyState === 'all-visible'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
        </svg>
        <svg v-else-if="privacyState === 'all-hidden'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
          <line x1="1" y1="1" x2="23" y2="23"/>
        </svg>
        <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/><line x1="3" y1="21" x2="21" y2="3" stroke-dasharray="3 3"/>
        </svg>
      </button>
    </template>
    <div class="privacy-panel">
      <div class="panel-header">
        <span class="panel-title">隐私设置</span>
        <div class="panel-actions">
          <button class="act-btn" @click="settingsStore.showAllPrivacy()">全显</button>
          <button class="act-btn act-hide" @click="settingsStore.hideAllPrivacy()">全隐</button>
        </div>
      </div>
      <div class="panel-group">
        <label v-for="item in items" :key="item.key" class="check-row">
          <input type="checkbox" :checked="settingsStore.privacy[item.key]" @change="toggle(item.key)" class="check-box" />
          <span class="check-label">{{ item.label }}</span>
        </label>
      </div>
    </div>
  </el-popover>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useSettingsStore } from '@/modules/settings/settings-store'
import type { PrivacySettings } from '@/modules/settings/settings-store'

defineProps<{ visible: boolean }>()
const emit = defineEmits<{ 'update:visible': [val: boolean] }>()

const settingsStore = useSettingsStore()
const privacyState = computed(() => settingsStore.privacyState)

const eyeState = computed(() => ({
  'eye-all-visible': privacyState.value === 'all-visible',
  'eye-partial': privacyState.value === 'partial',
  'eye-all-hidden': privacyState.value === 'all-hidden',
}))

const eyeTitle = computed(() => {
  if (privacyState.value === 'all-visible') return '隐私模式：全部显示'
  if (privacyState.value === 'all-hidden') return '隐私模式：全部隐藏'
  return '隐私模式：部分隐藏'
})

const items: { key: keyof PrivacySettings; label: string }[] = [
  { key: 'holding',     label: '持有金额' },
  { key: 'todayProfit', label: '今日收益' },
  { key: 'todayRate',   label: '今日收益率' },
  { key: 'totalProfit', label: '累计收益' },
  { key: 'totalRate',   label: '累计收益率' },
]

function toggle(key: keyof PrivacySettings): void {
  settingsStore.privacy[key] = !settingsStore.privacy[key]
}
</script>
<style scoped>
.btn-eye {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-full);
  border: 1px solid var(--border-default);
  background: transparent;
  cursor: pointer;
  transition: all var(--transition-fast);
  flex-shrink: 0;
  color: var(--text-muted);
}
.btn-eye:hover {
  border-color: var(--color-primary);
  color: var(--color-primary-light);
  background: var(--color-primary-glow);
}
.btn-eye.eye-all-visible {
  color: var(--color-primary-light);
  border-color: var(--color-primary);
}
.btn-eye.eye-all-hidden {
  color: var(--text-muted);
  opacity: 0.7;
}
.btn-eye.eye-partial {
  color: var(--color-primary);
  border-color: var(--color-primary);
}

.privacy-panel {
  padding: 4px 0;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 12px 8px;
}
.panel-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}
.panel-actions {
  display: flex;
  gap: 6px;
}
.act-btn {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  border: 1px solid var(--border-default);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}
.act-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary-light);
  background: var(--color-primary-glow);
}
.act-hide:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: var(--color-primary-glow);
}

.panel-group {
  padding: 0 12px 4px;
}
.check-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  cursor: pointer;
}
.check-box {
  width: 14px;
  height: 14px;
  accent-color: var(--color-primary);
  cursor: pointer;
  flex-shrink: 0;
}
.check-label {
  font-size: 12px;
  color: var(--text-secondary);
  user-select: none;
}
</style>
<style>

.privacy-popper {
  background: var(--glass-bg) !important;
  backdrop-filter: blur(16px) !important;
  -webkit-backdrop-filter: blur(16px) !important;
  border: 1px solid var(--border-default) !important;
  border-radius: var(--radius-md) !important;
  padding: 0 !important;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15) !important;
}
</style>
