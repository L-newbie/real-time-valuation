<template>
  <div v-if="cards.length > 0" class="op-records">
    <div class="op-head">
      <span class="op-title">操作记录</span>
      <span class="op-count font-number">{{ cards.length }}</span>
    </div>
    <div class="op-grid">
      <div
        v-for="m in cards"
        :key="m.pending ? m.id : m.at"
        :class="['op-card', m.pending && 'op-card-pending']"
      >
        <div class="op-card-top">
          <span :class="['op-type', typeClass(m)]">{{ typeText(m) }}</span>
          <span :class="['op-badge', m.pending ? 'badge-pending' : 'badge-done']">
            {{ m.pending ? '待确认' : '已成交' }}
          </span>
        </div>
        <div class="op-amount font-number">{{ primaryAmount(m) }}</div>
        <div class="op-sub">下单 {{ fullDate(m.date) }}
          <span v-if="m.nav && m.nav > 0" class="op-nav font-number"> · 净值 {{ m.nav.toFixed(4) }}</span>
        </div>
        <div v-if="m.pending && m.execDate" class="op-exec font-number">预计 {{ fullDate(m.execDate) }} 净值成交</div>
        <button v-if="m.pending" class="op-cancel-btn" @click="onCancel(m)">取消计划</button>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">

import { computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useHoldingStore } from '@/modules/holding/holding-store'
import { useGroupStore } from '@/modules/group/group-store'
import { confirm } from '@/composables/use-confirm'
import { getTradeMarks } from '@/modules/holding/trade-marks'
import type { TradeMark } from '@/modules/holding/trade-marks'

const props = defineProps<{
  fundCode: string
}>()

const holdingStore = useHoldingStore()
const groupStore = useGroupStore()

const cards = computed<TradeMark[]>(() =>
  [...getTradeMarks(holdingStore.groupActions, holdingStore.groupPendingActions, props.fundCode, groupStore.activeGroupId)].reverse(),
)

function fullDate(date: string): string {
  const [y, mo, d] = date.split('-')
  if (!y || !mo || !d) return date
  return `${y.slice(2)}.${Number(mo)}.${Number(d)}`
}

function primaryAmount(m: TradeMark): string {
  const nav = m.nav != null && m.nav > 0 ? m.nav : 0
  let amount = m.amount != null && m.amount > 0 ? m.amount : 0
  let shares = m.shares != null && m.shares > 0 ? m.shares : 0
  if (!amount && shares && nav) amount = shares * nav
  if (!shares && amount && nav) shares = amount / nav
  const parts: string[] = []
  if (amount > 0) parts.push(`¥${amount.toFixed(2)}`)
  if (shares > 0) parts.push(`${shares.toFixed(2)} 份`)
  return parts.join(' · ') || '--'
}

function typeText(m: TradeMark): string {
  if (m.pending) return m.side === 'buy' ? '加仓' : '减仓'
  if (m.open) return '建仓'
  if (m.side === 'buy') return '加仓'
  if (m.side === 'settle') return '清仓'
  return '减仓'
}

function typeClass(m: TradeMark): string {
  return m.side === 'buy' ? 'type-add' : 'type-reduce'
}

async function onCancel(m: TradeMark): Promise<void> {
  if (!m.id) return
  const actionLabel = m.side === 'buy' ? `加仓 ¥${(m.amount ?? 0).toFixed(2)}` : `减仓 ${(m.shares ?? 0).toFixed(2)} 份`
  const confirmed = await confirm({
    title: '取消待确认计划',
    desc: `确认取消${actionLabel}计划？取消后将不会再执行。`,
    confirmText: '确认取消',
    cancelText: '保留',
  })
  if (!confirmed) return
  const ok = holdingStore.cancelPendingAction(m.id)
  if (ok) ElMessage.success('已取消该计划')
  else ElMessage.warning('该计划已执行或不存在，无法取消')
}
</script>
<style scoped>
.op-records {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.op-head {
  display: flex;
  align-items: center;
  gap: 6px;
}
.op-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}
.op-count {
  font-size: 10px;
  color: var(--color-primary-light);
  background: var(--color-primary-glow);
  padding: 0 6px;
  border-radius: var(--radius-full);
  line-height: 1.6;
}

.op-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 10px;
}

.op-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
}
.op-card-pending {
  border-style: dashed;
}

.op-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.op-type {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 7px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}
.type-add { background: rgba(239,68,68,0.12); color: #ef4444; }
.type-reduce { background: rgba(34,197,94,0.12); color: #22c55e; }

.op-badge {
  font-size: 9px;
  padding: 1px 6px;
  border-radius: var(--radius-full);
  line-height: 1.5;
}
.badge-pending {
  color: var(--color-primary-light);
  background: var(--color-primary-glow);
}
.badge-done {
  color: var(--text-muted);
  background: var(--bg-surface-2, rgba(0,0,0,0.04));
}

.op-amount {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.2;
}

.op-sub {
  font-size: 10px;
  color: var(--text-muted);
  line-height: 1.5;
}
.op-nav { color: var(--text-muted); }

.op-exec {
  font-size: 10px;
  color: var(--color-primary-light);
  line-height: 1.5;
}

.op-cancel-btn {
  align-self: flex-end;
  margin-top: 2px;
  height: 22px;
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
.op-cancel-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: var(--color-primary-glow);
}
</style>
