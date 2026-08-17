<template>
  <div v-if="plans.length > 0" class="pending-plan-list">
    <div class="plan-head">
      <span class="plan-title">待确认计划</span>
      <span class="plan-count font-number">{{ plans.length }}</span>
    </div>
    <div v-for="p in plans" :key="p.id" class="plan-item">
      <div class="plan-main">
        <span :class="['plan-type', p.type === 'add' ? 'type-add' : 'type-reduce']">
          {{ p.type === 'add' ? '加仓' : '减仓' }}
        </span>
        <span v-if="showFund" class="plan-fund-name">{{ fundName(p.fundCode) }}</span>
        <span class="plan-amount font-number" :class="{ 'privacy-blur': !privacy.holding }">
          {{ p.type === 'add' ? '¥' : '' }}{{ formatAmount(p) }}{{ p.type === 'add' ? '' : ' 份' }}
        </span>
      </div>
      <div class="plan-meta">
        <span class="plan-date" :class="statusClass(p)">{{ statusText(p) }}</span>
        <button class="plan-cancel-btn" @click="onCancel(p)">{{ isFailed(p) ? '清除' : '取消计划' }}</button>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">

import { computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useHoldingStore } from '@/modules/holding/holding-store'
import { useFundStore } from '@/modules/fund/fund-store'
import { useSettingsStore } from '@/modules/settings/settings-store'
import { confirm } from '@/composables/use-confirm'
import type { PendingAction } from '@/modules/holding/holding-types'
import { PendingActionStatus } from '@/modules/holding/holding-types'

const props = defineProps<{
  fundCode?: string
}>()

const holdingStore = useHoldingStore()
const fundStore = useFundStore()
const settingsStore = useSettingsStore()
const privacy = computed(() => settingsStore.privacy)

const showFund = computed(() => !props.fundCode)

const plans = computed<PendingAction[]>(() =>
  props.fundCode ? holdingStore.getPendingByFund(props.fundCode) : holdingStore.pendingOrFailed,
)

function isFailed(p: PendingAction): boolean {
  return p.status === PendingActionStatus.Failed
}

function shortDate(date: string): string {
  const [, m, d] = date.split('-')
  if (!m || !d) return date
  return `${Number(m)}.${Number(d)}`
}

function statusText(p: PendingAction): string {
  if (isFailed(p)) return `${shortDate(p.scheduledDate)} 日未成交${p.failedReason ? `（${p.failedReason}）` : ''}`
  const tried = p.attemptCount ?? 0
  const base = `待 ${shortDate(p.scheduledDate)} 日净值更新确认`
  return tried > 0 ? `${base}（已重试 ${tried} 次）` : base
}

function statusClass(p: PendingAction): string {
  return isFailed(p) ? 'status-failed' : ''
}

function fundName(code: string): string {
  return fundStore.resolveFundName(code)
}

function formatAmount(p: PendingAction): string {
  return p.type === 'add'
    ? p.amount.toFixed(2)
    : p.amount.toFixed(2)
}

async function onCancel(p: PendingAction): Promise<void> {
  const actionLabel = p.type === 'add' ? `加仓 ¥${p.amount.toFixed(2)}` : `减仓 ${p.amount.toFixed(2)} 份`
  const fundLabel = props.fundCode ? '' : `「${fundStore.resolveFundName(p.fundCode)}」`
  const confirmed = await confirm({
    title: isFailed(p) ? '清除未成交计划' : '取消待确认计划',
    desc: isFailed(p)
      ? `${fundLabel}的${actionLabel}计划在 ${p.scheduledDate} 未能成交，已不会再自动执行。清除后如仍需操作请重新提交。`
      : `确认取消${fundLabel}的${actionLabel}计划？取消后将不会在 ${p.scheduledDate} 执行。`,
    confirmText: isFailed(p) ? '清除' : '确认取消',
    cancelText: '保留',
  })
  if (!confirmed) return
  const ok = holdingStore.cancelPendingAction(p.id)
  if (ok) ElMessage.success(isFailed(p) ? '已清除该计划' : '已取消该计划')
  else ElMessage.warning('该计划已执行或不存在，无法取消')
}
</script>
<style scoped>
.pending-plan-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--bg-surface);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
}

.plan-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 2px;
}
.plan-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}
.plan-count {
  font-size: 10px;
  color: var(--color-primary-light);
  background: var(--color-primary-glow);
  padding: 0 6px;
  border-radius: var(--radius-full);
  line-height: 1.6;
}

.plan-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
  padding: 6px 0;
  border-top: 1px solid var(--border-default);

  flex-wrap: wrap;
  row-gap: 4px;
}
.plan-item:first-of-type { border-top: none; }

.plan-main {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1 1 auto;
}
.plan-type {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 7px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}
.type-add { background: rgba(239,68,68,0.12); color: #ef4444; }
.type-reduce { background: rgba(34,197,94,0.12); color: #22c55e; }

.plan-fund-name {
  font-size: 12px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.plan-amount {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);

  flex-shrink: 0;
  white-space: nowrap;
}

.plan-meta {
  display: flex;
  align-items: center;
  gap: 8px;

  flex: 0 1 auto;
  min-width: 0;
  margin-left: auto;
}
.plan-date {
  font-size: 10px;
  color: var(--text-muted);
  min-width: 0;

  overflow: hidden;
  text-overflow: ellipsis;
}

.plan-date.status-failed {
  color: #ef4444;
}

.plan-cancel-btn {
  height: 24px;
  padding: 0 10px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 11px;
  transition: all var(--transition-fast);
  white-space: nowrap;
}
.plan-cancel-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: var(--color-primary-glow);
}
</style>
