<template>
  <div class="data-page">
    <header class="data-header glass-card">
      <button class="back-btn" @click="router.back()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        <span>返回</span>
      </button>
      <h2 class="page-title">数据管理</h2>
      <div class="header-placeholder"></div>
    </header>
    <div class="data-body">
      <section class="dm-overview">
        <div class="dm-stat">
          <span class="dm-stat-num font-number">{{ totalItems }}</span>
          <span class="dm-stat-label">数据项</span>
        </div>
        <div class="dm-stat">
          <span class="dm-stat-num font-number">{{ storageSize }}</span>
          <span class="dm-stat-label">本地占用</span>
        </div>
      </section>
      <SettingsSection title="数据管理" danger>
        <div class="danger-zone">
          <div class="danger-zone-header">
            <span class="danger-zone-desc">点击对应数据类型即可清除该项数据，或点底部「全部清除」一键清空。清除后应用将自动刷新，此操作不可撤销。</span>
          </div>
          <div class="clear-options">
            <button
              v-for="opt in clearOptions"
              :key="opt.key"
              class="clear-option"
              :disabled="clearing"
              @click="askClear([opt])"
            >
              <span class="clear-option-content">
                <span class="clear-option-top">
                  <span class="clear-option-label">{{ opt.label }}</span>
                  <span v-if="counts[opt.key]" class="clear-option-count">{{ counts[opt.key] }}</span>
                  <span v-else class="clear-option-count is-empty">无数据</span>
                </span>
                <span class="clear-option-desc">{{ opt.desc }}</span>
              </span>
              <svg class="clear-option-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
          <button class="btn-danger" @click="askClear(clearOptions)" :disabled="clearing">
            {{ clearing ? '清除中...' : '全部清除' }}
          </button>
        </div>
      </SettingsSection>
    </div>
    <ConfirmModal
      :visible="showConfirmModal"
      :title="pendingKeys.length === clearOptions.length ? '确认全部清除' : '确认清除数据'"
      desc="将清除以下数据，应用将自动刷新。此操作不可撤销。"
      confirm-text="确认清除"
      cancel-text="取消"
      :loading="clearing"
      :items="pendingItems"
      @confirm="executeClearData"
      @cancel="cancelConfirm"
      @update:visible="cancelConfirm"
    />
  </div>
</template>
<script setup lang="ts">

import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useFundStore } from '@/modules/fund/fund-store'
import { useCacheStore } from '@/modules/fund/cache-store'
import { useHoldingStore } from '@/modules/holding/holding-store'
import { useStockStore } from '@/modules/stock/stock-store'
import { STORAGE_KEYS } from '@/config/constants'
import SettingsSection from '@/views/settings/settings-section.vue'
import ConfirmModal from '@/components/shared/confirm-modal.vue'
import { cacheStorageKeys } from '@/shared/cache/define-cache'
import '@/modules/fund/services/holiday-service'
import '@/modules/fund/services/yahoo-symbol'
import '@/modules/fund/misc/manager-check'
import '@/modules/index/index-store'
import '@/modules/fund/fund-store'
import '@/modules/fund/cache-store'
import '@/modules/stock/stock-store'
import '@/modules/news/news-store'
import '@/modules/stock/sector-cache'
import '@/modules/fund/services/fund-base-info'

const router = useRouter()

const clearing = ref(false)
const showConfirmModal = ref(false)

interface ClearOption {
  key: string
  label: string
  desc: string
  keys: string[]
}

const clearOptions = ref<ClearOption[]>([
  {
    key: 'settings',
    label: '应用设置',
    desc: '主题、刷新间隔、动画开关、资讯偏好等',
    keys: [STORAGE_KEYS.USER_SETTINGS, STORAGE_KEYS.VIEW_MODE, STORAGE_KEYS.ACTIVE_TAB, STORAGE_KEYS.COLUMN_CONFIG, STORAGE_KEYS.AUTO_REFRESH, STORAGE_KEYS.REFRESH_INTERVAL, STORAGE_KEYS.LANDING_SEEN],
  },
  {
    key: 'funds',
    label: '自选基金',
    desc: '关注的基金代码列表与分组',
    keys: [STORAGE_KEYS.FUND_CODES, STORAGE_KEYS.FUND_GROUPS, STORAGE_KEYS.GROUP_MEMBERS, STORAGE_KEYS.ACTIVE_GROUP],
  },
  {
    key: 'holdings',
    label: '持仓数据',
    desc: '持仓份额、成本价、操作日志、待确认操作',
    keys: [STORAGE_KEYS.HOLDINGS, STORAGE_KEYS.HOLDING_ACTIONS, STORAGE_KEYS.PENDING_ACTIONS],
  },
  {
    key: 'stocks',
    label: '行情数据',
    desc: '自选股票列表、指数选择',
    keys: [STORAGE_KEYS.WATCHLIST, STORAGE_KEYS.SELECTED_INDICES],
  },
  {
    key: 'news',
    label: '资讯数据',
    desc: '资讯黑名单、已读记录',
    keys: [STORAGE_KEYS.NEWS_BLACKLIST, STORAGE_KEYS.NEWS_READ],
  },
  {
    key: 'cache',
    label: '缓存数据',
    desc: '估值/分时/T+2持仓涨跌/Yahoo解析等缓存（跨日自动失效，清除后重拉）',

    keys: [
      STORAGE_KEYS.FUND_CACHE,
      STORAGE_KEYS.FUND_NAMES,
      STORAGE_KEYS.STOCK_PREV_DAY_CACHE, STORAGE_KEYS.STOCK_PREV_DAY_DATE,
      STORAGE_KEYS.STOCK_REALTIME_CACHE, STORAGE_KEYS.STOCK_REALTIME_DATE,
      STORAGE_KEYS.INDEX_QUOTES_CACHE, STORAGE_KEYS.INDEX_QUOTES_DATE,
      STORAGE_KEYS.STOCK_QUOTES_CACHE, STORAGE_KEYS.STOCK_QUOTES_DATE,
      STORAGE_KEYS.YAHOO_SYMBOL_CACHE,
      STORAGE_KEYS.INTRADAY_MAP, STORAGE_KEYS.INTRADAY_MAP_DATE,
      STORAGE_KEYS.MARKET_HOLIDAYS,
      STORAGE_KEYS.FUND_MANAGERS,
      STORAGE_KEYS.TASKS,
      STORAGE_KEYS.ESTIMATED_HOLDINGS_CACHE, STORAGE_KEYS.ESTIMATED_HOLDINGS_DATE,
      STORAGE_KEYS.ESTIMATED_GSZZL_CACHE, STORAGE_KEYS.ESTIMATED_GSZZL_DATE,
      STORAGE_KEYS.T1_HOLDINGS_CACHE, STORAGE_KEYS.T1_HOLDINGS_DATE,
      STORAGE_KEYS.SECTOR_CACHE,
      STORAGE_KEYS.LAST_BUSINESS_DAY,
      ...cacheStorageKeys(),
    ],
  },
])

const counts = computed<Record<string, string>>(() => {
  const fundStore = useFundStore()
  const holdingStore = useHoldingStore()
  const stockStore = useStockStore()
  return {
    settings: '已配置',
    funds: fundStore.fundCodes.length > 0 ? `${fundStore.fundCodes.length} 只` : '',
    holdings: holdingStore.holdings.length > 0 ? `${holdingStore.holdings.length} 条` : '',
    stocks: stockStore.watchlist.length > 0 ? `${stockStore.watchlist.length} 只` : '',
    news: '已缓存',
    cache: '已缓存',
  }
})

const totalItems = computed(() => {
  const fundStore = useFundStore()
  const holdingStore = useHoldingStore()
  const stockStore = useStockStore()
  return fundStore.fundCodes.length + holdingStore.holdings.length + stockStore.watchlist.length
})

const storageSize = computed(() => {
  try {
    let bytes = 0
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k || !k.startsWith('jgb_')) continue
      bytes += k.length + (localStorage.getItem(k)?.length ?? 0)
    }

    const kb = (bytes * 2) / 1024
    if (kb < 1) return '<1 KB'
    if (kb < 1024) return `${Math.round(kb)} KB`
    return `${(kb / 1024).toFixed(1)} MB`
  } catch {
    return '—'
  }
})

const pending = ref<ClearOption[]>([])
const pendingKeys = computed(() => pending.value.map(o => o.key))

const pendingItems = computed(() =>
  pending.value.map(o => ({ label: o.label, desc: o.desc }))
)

function askClear(items: ClearOption[]): void {
  if (clearing.value) return
  pending.value = items
  showConfirmModal.value = true
}

function cancelConfirm(): void {
  if (clearing.value) return
  showConfirmModal.value = false
  pending.value = []
}

function executeClearData(): void {
  if (clearing.value) return

  clearing.value = true
  try {
    const checkedKeys = new Set(pending.value.map(o => o.key))

    if (checkedKeys.has('cache')) {
      useCacheStore().clearAllCache()
      useFundStore().clearCacheDataInMemory()
    }
    if (checkedKeys.has('funds')) {
      const fundStore = useFundStore()
      fundStore.fundCodes = []
      fundStore.fundNameMap = {}
    }
    if (checkedKeys.has('holdings')) {
      useHoldingStore().clearAllHoldings()
    }

    const keysToRemove = new Set<string>()
    for (const opt of pending.value) {
      for (const key of opt.keys) {
        keysToRemove.add(key)
      }
    }
    for (const key of keysToRemove) {
      localStorage.removeItem(key)
    }

    ;(window as unknown as { __skipPersistOnUnload?: boolean }).__skipPersistOnUnload = true

    setTimeout(() => {
      window.location.reload()
    }, 300)
  } catch {
    clearing.value = false
    showConfirmModal.value = false
    pending.value = []
    alert('清除失败，请重试')
  }
}
</script>
<style scoped>

.dm-overview {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
}
.dm-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: var(--spacing-md) var(--spacing-sm);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-default);
  background: var(--bg-card);
}
.dm-stat-num {
  font-size: var(--font-2xl);
  font-weight: 700;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
}
.dm-stat-label { font-size: var(--font-xs); color: var(--text-muted); }

.clear-option-top { display: flex; align-items: center; gap: var(--spacing-sm); }
.clear-option-count {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 7px;
  border-radius: var(--radius-full);
  background: var(--color-primary-glow);
  color: var(--color-primary);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.clear-option-count.is-empty {
  background: var(--border-subtle);
  color: var(--text-muted);
}

.data-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: var(--spacing-md);

  padding-bottom: calc(var(--spacing-md) + env(safe-area-inset-bottom, 0px));
  gap: var(--spacing-sm);
}

.data-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  flex-shrink: 0;
}
.back-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: var(--radius-full);
  border: 1px solid var(--border-default);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: var(--font-xs);
  transition: all var(--transition-fast);
}
.back-btn:hover { color: var(--text-primary); border-color: var(--border-hover); }
.page-title {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  margin: 0;
  pointer-events: none;
  font-size: var(--font-lg);
  font-weight: 700;
  color: var(--text-primary);
  text-align: center;
}
.header-placeholder { display: none; }

.data-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-bottom: var(--spacing-md);
}

.danger-zone {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}
.danger-zone-header {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.danger-zone-desc {
  font-size: var(--font-xs);
  color: var(--text-muted);
  line-height: 1.5;
}
.clear-options {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.clear-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
  width: 100%;
  padding: var(--spacing-md) var(--spacing-sm);
  border: none;
  border-top: 1px solid var(--border-default);
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: background var(--transition-fast);
  font-family: inherit;
}
.clear-options .clear-option:first-child {
  border-top: none;
  border-radius: var(--radius-md) var(--radius-md) 0 0;
}
.clear-option:hover:not(:disabled) {
  background: var(--bg-card-hover);
}
.clear-option:active:not(:disabled) {
  background: var(--color-rise-glow);
}
.clear-option:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.clear-option-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}
.clear-option-label {
  font-size: var(--font-md);
  font-weight: 600;
  color: var(--text-primary);
}
.clear-option-desc {
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.4;
}
.clear-option-arrow {
  flex-shrink: 0;
  color: var(--color-rise);
  opacity: 0.6;
  transition: transform var(--transition-fast), opacity var(--transition-fast);
}
.clear-option:hover .clear-option-arrow,
.clear-option:active .clear-option-arrow {
  transform: translateX(2px);
  opacity: 1;
}

.btn-danger {
  padding: 9px 16px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-rise);
  background: transparent;
  color: var(--color-rise);
  font-size: var(--font-sm);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
  align-self: center;
  min-width: 160px;
}
.btn-danger:hover:not(:disabled) {
  background: var(--color-rise);
  color: #fff;
}
.btn-danger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 767px) {
  .data-page { padding: var(--spacing-sm); }
  .data-header { padding: var(--spacing-sm) var(--spacing-md); }
}
</style>
