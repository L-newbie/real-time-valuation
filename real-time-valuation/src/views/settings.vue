<template>
  <div class="st-page">
    <header class="st-header">
      <button class="st-back" @click="router.back()" title="返回">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
      <div class="st-title-wrap">
        <h1 class="st-title">设置</h1>
        <span class="st-sub">外观 · 提醒 · 数据</span>
      </div>
      <button class="st-reset" title="恢复默认设置" @click="showResetConfirm = true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" />
        </svg>
      </button>
    </header>
    <div class="st-body">
      <SettingsGroup title="外观与视觉" :open="isOpen('look')" @update:open="setOpen('look', $event)">
        <div class="st-row">
          <div class="st-row-info">
            <span class="st-row-label">主题模式</span>
            <span class="st-row-desc">暗色 / 亮色</span>
          </div>
          <div class="st-theme">
            <button
              v-for="t in THEMES"
              :key="t.value"
              class="st-theme-btn"
              :class="{ on: settingsStore.theme === t.value }"
              @click="settingsStore.setTheme(t.value)"
            >{{ t.label }}</button>
          </div>
        </div>
      </SettingsGroup>
      <SettingsGroup title="基金" :open="isOpen('fund')" @update:open="setOpen('fund', $event)">
        <div class="st-row">
          <div class="st-row-info">
            <span class="st-row-label">基金经理变更检测</span>
            <span class="st-row-desc">每日检测关注基金的经理是否变更并提示</span>
          </div>
          <label class="st-switch">
            <input type="checkbox" v-model="settingsStore.enableManagerCheck" />
            <span class="st-switch-slider" />
          </label>
        </div>
        <div class="st-row">
          <div class="st-row-info">
            <span class="st-row-label">开启实时涨跌幅</span>
            <span class="st-row-desc">拉取持仓股票行情并加权推算盘中实时涨跌。不关注可关闭以节省流量</span>
          </div>
          <label class="st-switch">
            <input type="checkbox" v-model="settingsStore.enablePrediction" />
            <span class="st-switch-slider" />
          </label>
        </div>
      </SettingsGroup>
      <section class="st-links">
        <button class="st-link" @click="go('/settings/indices')">
          <span class="st-link-label">指数选择</span>
          <span class="st-link-desc">选择在基金页展示的指数</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
        <button class="st-link" @click="go('/settings/data')">
          <span class="st-link-label">数据管理</span>
          <span class="st-link-desc">清除自选、持仓、缓存等本地数据</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
        <button class="st-link" @click="go('/settings/about')">
          <span class="st-link-label">关于</span>
          <span class="st-link-desc">版本、数据来源与使用提示</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </section>
    </div>
    <ConfirmModal
      :visible="showResetConfirm"
      title="恢复默认设置"
      desc="将主题、动画效果、刷新间隔等所有设置恢复为默认值。自选基金、持仓等数据不受影响。"
      confirm-text="确认恢复"
      cancel-text="取消"
      @confirm="executeResetDefaults"
      @cancel="showResetConfirm = false"
      @update:visible="showResetConfirm = false"
    />
  </div>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSettingsStore } from '@/modules/settings/settings-store'
import type { ThemeMode } from '@/modules/settings/settings-store'
import ConfirmModal from '@/components/shared/confirm-modal.vue'
import SettingsGroup from '@/views/settings/settings-group.vue'

const router = useRouter()
const settingsStore = useSettingsStore()
const showResetConfirm = ref(false)

const openGroups = ref<Set<string>>(new Set(['look']))
function isOpen(k: string): boolean { return openGroups.value.has(k) }
function setOpen(k: string, v: boolean): void {
  const next = new Set(openGroups.value)
  if (v) next.add(k)
  else next.delete(k)
  openGroups.value = next
}

const THEMES: { value: ThemeMode; label: string }[] = [
  { value: 'dark', label: '暗色' },
  { value: 'light', label: '亮色' },
]

function go(path: string): void { router.push(path) }

function executeResetDefaults(): void {
  settingsStore.resetToDefaults()
  showResetConfirm.value = false
}
</script>
<style scoped>
.st-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  padding: var(--spacing-md);
  gap: var(--spacing-md);
}

.st-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-shrink: 0;
}
.st-back,
.st-reset {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: var(--radius-full);
  border: 1px solid var(--border-default);
  background: var(--bg-card);
  color: var(--text-secondary);
  cursor: pointer;
  flex-shrink: 0;
  transition: background-color var(--transition-fast), color var(--transition-fast);
}
.st-back:hover { background: var(--bg-card-hover); color: var(--text-primary); }
.st-reset:hover { background: var(--color-rise-glow); color: var(--color-rise); border-color: var(--color-rise); }

.st-title-wrap { display: flex; flex-direction: column; gap: 1px; flex: 1; min-width: 0; }
.st-title { font-size: var(--font-lg); font-weight: 700; color: var(--text-primary); margin: 0; }
.st-sub { font-size: var(--font-xs); color: var(--text-muted); }

.st-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding-bottom: calc(var(--nav-height) + var(--spacing-md));
}
@media (min-width: 1024px) {
  .st-body { padding-bottom: var(--spacing-md); }
}

.st-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  padding: var(--spacing-sm) 0;
}
.st-row + .st-row { border-top: 1px solid var(--border-subtle); }
.st-row-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
.st-row-label { font-size: var(--font-sm); font-weight: 500; color: var(--text-primary); }
.st-row-desc { font-size: var(--font-xs); color: var(--text-muted); line-height: 1.4; }
.st-row-ctrl { display: flex; align-items: center; gap: var(--spacing-sm); flex-shrink: 0; }

.st-switch { position: relative; display: inline-block; width: 40px; height: 22px; flex-shrink: 0; }
.st-switch input { opacity: 0; width: 0; height: 0; }
.st-switch-slider {
  position: absolute;
  inset: 0;
  border-radius: var(--radius-full);
  background: var(--bg-elevated);
  cursor: pointer;
  transition: background-color var(--transition-fast);
}
.st-switch-slider::before {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
  left: 3px;
  top: 3px;
  border-radius: 50%;
  background: var(--text-secondary);
  transition: transform var(--transition-fast), background-color var(--transition-fast);
}
.st-switch input:checked + .st-switch-slider { background: var(--color-primary); }
.st-switch input:checked + .st-switch-slider::before {
  transform: translateX(18px);
  background: var(--color-on-primary);
}

.st-theme {
  display: inline-flex;
  padding: 3px;
  border-radius: var(--radius-full);
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  flex-shrink: 0;
}
.st-theme-btn {
  padding: 4px 14px;
  border: none;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--text-muted);
  font-size: var(--font-xs);
  font-weight: 600;
  cursor: pointer;
  transition: background-color var(--transition-fast), color var(--transition-fast);
}
.st-theme-btn.on { background: var(--color-primary); color: var(--color-on-primary); }

.st-links {
  display: flex;
  flex-direction: column;
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  overflow: hidden;
}
.st-link {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  text-align: left;
  transition: background-color var(--transition-fast);
}
.st-link + .st-link { border-top: 1px solid var(--border-subtle); }
.st-link:hover { background: var(--bg-card-hover); }
.st-link-label { font-size: var(--font-sm); font-weight: 500; color: var(--text-primary); flex-shrink: 0; }
.st-link-desc {
  font-size: var(--font-xs);
  color: var(--text-muted);
  flex: 1;
  text-align: right;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (max-width: 767px) {
  .st-page { padding: var(--spacing-sm); }
  .st-row { flex-wrap: wrap; }
  .st-link-desc { display: none; }
}
</style>
