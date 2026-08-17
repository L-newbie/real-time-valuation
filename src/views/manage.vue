<template>
  <div class="manage-page">
    <header class="mg-header">
      <button class="mg-back" @click="router.back()" title="返回">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
      <div class="mg-title-wrap">
        <h2 class="mg-title">基金管理</h2>
        <span class="mg-sub">{{ groupStore.activeGroup?.name || '分组' }} · {{ groupStore.activeCodes.length }} 只基金</span>
      </div>
      <button
        v-if="groupStore.activeCodes.length > 0"
        class="mg-select-toggle"
        :class="{ on: selectMode }"
        @click="toggleSelectMode"
      >
        {{ selectMode ? '完成' : '选择' }}
      </button>
    </header>
    <div class="mg-body">
      <div class="mg-cards">
        <article
          v-for="code in groupStore.activeCodes"
          :key="code"
          class="mg-card"
          :class="{ selected: selectedCodes.includes(code), 'is-selectable': selectMode }"
          @click="selectMode ? toggleSelect(code) : undefined"
        >
          <header class="mg-card-head">
            <span v-if="selectMode" class="mg-check" :class="{ on: selectedCodes.includes(code) }">
              <svg v-if="selectedCodes.includes(code)" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </span>
            <span v-else class="mg-mark mark-chip" :style="markStyle(code)">
              {{ (fundStore.resolveFundName(code) || code).trim().charAt(0) }}
            </span>
            <div class="mg-ident">
              <span class="mg-name">{{ fundStore.resolveFundName(code) }}</span>
              <span class="mg-code">{{ code }}</span>
            </div>
            <div class="mg-figures">
              <span v-if="getHoldingAmount(code) > 0" class="mg-amount font-number">
                ¥{{ formatCompactMoney(getHoldingAmount(code)) }}
              </span>
              <span v-else class="mg-amount mg-amount-none">未持仓</span>
              <span
                v-if="getHoldingAmount(code) > 0"
                :class="['mg-profit font-number', getTodayProfit(code) > 0 ? 'text-rise' : getTodayProfit(code) < 0 ? 'text-fall' : 'text-flat']"
              >
                今日 {{ getTodayProfit(code) > 0 ? '+' : '' }}{{ getTodayProfit(code).toFixed(2) }}
              </span>
            </div>
          </header>
          <div v-if="!selectMode" class="mg-ops">
            <template v-if="getHoldingAmount(code) > 0">
              <button class="mg-op" :class="{ on: activeForm[code] === 'add' }" @click.stop="toggleForm(code, 'add')">加仓</button>
              <button class="mg-op" :class="{ on: activeForm[code] === 'reduce' }" @click.stop="toggleForm(code, 'reduce')">减仓</button>
              <button class="mg-op" :class="{ on: activeForm[code] === 'edit' }" @click.stop="toggleForm(code, 'edit')">编辑</button>
              <button class="mg-op" @click.stop="confirmClearHolding(code)">清空</button>
            </template>
            <button v-else class="mg-op mg-op-primary" :class="{ on: activeForm[code] === 'edit' }" @click.stop="toggleForm(code, 'edit')">
              录入持仓
            </button>
            <span class="mg-ops-spacer" />
            <button class="mg-op mg-op-danger" @click.stop="confirmDelete(code)" title="删除基金">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
              </svg>
            </button>
          </div>
          <div class="mg-form-wrap" :class="{ open: !!activeForm[code] && !selectMode }">
            <div class="mg-form-clip">
              <div class="mg-form" @click.stop>
                <template v-if="activeForm[code] === 'add'">
                  <div class="mg-field">
                    <label class="mg-label">投入金额</label>
                    <div class="mg-input-wrap">
                      <span class="mg-unit">¥</span>
                      <input v-model.number="formData[code].amount" type="number" min="0" class="mg-input" placeholder="0.00" />
                    </div>
                  </div>
                  <p class="mg-hint">参考净值 {{ getReferenceNav(code).toFixed(4) }}</p>
                  <div class="mg-form-acts">
                    <button class="mg-fbtn" @click.stop="closeForm(code)">取消</button>
                    <button class="mg-fbtn mg-fbtn-primary" @click.stop="submitAdd(code)">确认加仓</button>
                  </div>
                </template>
                <template v-else-if="activeForm[code] === 'reduce'">
                  <div class="mg-field">
                    <label class="mg-label">赎回份额</label>
                    <div class="mg-input-wrap">
                      <input v-model.number="formData[code].shares" type="number" min="0" class="mg-input" placeholder="0.00" />
                      <span class="mg-unit mg-unit-suffix">份</span>
                    </div>
                  </div>
                  <p class="mg-hint">当前持有 {{ holdingStore.getTotalShares(code).toFixed(2) }} 份</p>
                  <div class="mg-form-acts">
                    <button class="mg-fbtn" @click.stop="closeForm(code)">取消</button>
                    <button class="mg-fbtn mg-fbtn-primary" @click.stop="submitReduce(code)">确认减仓</button>
                  </div>
                </template>
                <template v-else-if="activeForm[code] === 'edit'">
                  <div class="mg-field">
                    <label class="mg-label">持仓金额</label>
                    <div class="mg-input-wrap">
                      <span class="mg-unit">¥</span>
                      <input v-model.number="formData[code].holdingAmount" type="number" min="0" class="mg-input" placeholder="0.00" />
                    </div>
                  </div>
                  <div class="mg-field">
                    <label class="mg-label">累计收益</label>
                    <div class="mg-input-wrap">
                      <span class="mg-unit">¥</span>
                      <input v-model.number="formData[code].totalProfit" type="number" class="mg-input" placeholder="正盈负亏" />
                    </div>
                  </div>
                  <p class="mg-hint">投入本金 ¥{{ calcPrincipal(code).toFixed(2) }}</p>
                  <div class="mg-form-acts">
                    <button class="mg-fbtn" @click.stop="closeForm(code)">取消</button>
                    <button class="mg-fbtn mg-fbtn-primary" @click.stop="submitEdit(code)">确认修改</button>
                  </div>
                </template>
              </div>
            </div>
          </div>
          <PendingPlanList :fund-code="code" />
        </article>
        <div v-if="groupStore.activeCodes.length === 0" class="mg-empty">
          <p class="text-muted">暂无关注基金，请在首页搜索添加</p>
        </div>
      </div>
    </div>
    <Transition name="mg-batch">
      <div v-if="selectMode && selectedCodes.length > 0" class="mg-batch glass-card">
        <button class="mg-batch-all" @click="toggleSelectAll">
          {{ allSelected ? '取消全选' : '全选' }}
        </button>
        <span class="mg-batch-count">已选 {{ selectedCodes.length }}</span>
        <span class="mg-ops-spacer" />
        <button class="mg-fbtn" @click="batchClear">清空持仓</button>
        <button class="mg-fbtn mg-fbtn-danger" @click="batchDelete">删除</button>
      </div>
    </Transition>
  </div>
</template>
<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useFundStore } from '@/modules/fund/fund-store'
import { useHoldingStore } from '@/modules/holding/holding-store'
import { useGroupStore } from '@/modules/group/group-store'
import { removeFundFromActiveGroup } from '@/modules/group/group-actions'
import { confirm } from '@/composables/use-confirm'
import { findDateByNav } from '@/modules/holding/trade-marks'
import { peekNavSeries } from '@/modules/fund/perf/perf-intervals'
import PendingPlanList from '@/components/shared/pending-plan-list.vue'
import { formatCompactMoney } from '@/shared/utils/money-format'

const router = useRouter()
const fundStore = useFundStore()
const holdingStore = useHoldingStore()
const groupStore = useGroupStore()

const selectMode = ref(false)
const selectedCodes = ref<string[]>([])

function toggleSelectMode(): void {
  selectMode.value = !selectMode.value

  if (!selectMode.value) selectedCodes.value = []
  else {
    for (const k of Object.keys(activeForm)) delete activeForm[k]
  }
}

function markStyle(code: string): Record<string, string> {
  let h = 0
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) % 360

  h = 190 + (h % 75)
  return { '--mark-h': String(h) }
}

const allSelected = computed(() =>
  groupStore.activeCodes.length > 0 && selectedCodes.value.length === groupStore.activeCodes.length
)

function toggleSelect(code: string): void {
  if (selectedCodes.value.includes(code)) {
    selectedCodes.value = selectedCodes.value.filter(c => c !== code)
  } else {
    selectedCodes.value = [...selectedCodes.value, code]
  }
}

function toggleSelectAll(): void {
  if (allSelected.value) {
    selectedCodes.value = []
  } else {
    selectedCodes.value = [...groupStore.activeCodes]
  }
}

async function batchClear(): Promise<void> {
  const ok = await confirm({
    title: '批量清空持仓',
    desc: `确认清空选中的 ${selectedCodes.value.length} 只基金的持仓数据？`,
    confirmText: '确认清空',
    cancelText: '取消',
  })
  if (!ok) return
  for (const code of selectedCodes.value) {
    holdingStore.settleAllByFund(code)
  }
  ElMessage.success(`已清空 ${selectedCodes.value.length} 只基金的持仓`)
  selectedCodes.value = []
}

async function batchDelete(): Promise<void> {
  const ok = await confirm({
    title: '批量删除',
    desc: `确认从当前分组删除选中的 ${selectedCodes.value.length} 只基金？该分组下的持仓数据将一并清除。`,
    confirmText: '确认删除',
    cancelText: '取消',
  })
  if (!ok) return
  for (const code of selectedCodes.value) {
    removeFundFromActiveGroup(code)
  }
  ElMessage.success(`已删除 ${selectedCodes.value.length} 只基金`)
  selectedCodes.value = []
}

const activeForm = reactive<Record<string, 'add' | 'reduce' | 'edit' | null>>({})

const formData = reactive<Record<string, {
  amount: number | ''
  shares: number | ''
  holdingAmount: number | ''
  totalProfit: number | ''
}>>({})

function ensureFormData(code: string): void {
  if (!formData[code]) {
    formData[code] = {
      amount: '',
      shares: '',
      holdingAmount: '',
      totalProfit: '',
    }
  }
}

function toggleForm(code: string, type: 'add' | 'reduce' | 'edit'): void {
  ensureFormData(code)
  if (activeForm[code] === type) {
    activeForm[code] = null
  } else {
    if (type === 'edit') {
      const v = fundStore.getValuation(code)
      const holdAmt = holdingStore.getFundHoldingAmount(code, v?.dwjz, v?.gszzl, v?.isEstimated)
      if (holdAmt > 0) {
        const principal = holdingStore.getPrincipal(code)
        formData[code].holdingAmount = parseFloat(holdAmt.toFixed(2))
        formData[code].totalProfit = parseFloat((holdAmt - principal).toFixed(2))
      } else {
        formData[code].holdingAmount = ''
        formData[code].totalProfit = ''
      }
    }
    activeForm[code] = type
  }
}

function closeForm(code: string): void {
  activeForm[code] = null
}

function getHoldingAmount(code: string): number {
  const v = fundStore.getValuation(code)
  return holdingStore.getFundHoldingAmount(code, v?.dwjz, v?.gszzl, v?.isEstimated)
}

function getTodayProfit(code: string): number {
  const v = fundStore.getValuation(code)
  return holdingStore.calcFundTodayProfit(code, 0, v?.dwjz, v?.gszzl, v?.isEstimated, holdingStore.resolveGszzlDate(v))
}

function getReferenceNav(code: string): number {
  return fundStore.getValuation(code)?.dwjz ?? 0
}

function calcPrincipal(code: string): number {
  const d = formData[code]
  if (!d) return 0
  return Math.max(0, (d.holdingAmount || 0) - (d.totalProfit || 0))
}

function submitAdd(code: string): void {
  const d = formData[code]
  const nav = getReferenceNav(code)
  if (!d.amount || d.amount <= 0) { ElMessage.warning('请输入有效金额'); return }
  if (nav <= 0) { ElMessage.warning('当前净值不可用'); return }
  const delayDays = fundStore.getValuation(code)?.delayDays ?? 1
  holdingStore.createPendingAdd(code, d.amount, nav, delayDays)
  ElMessage.success('加仓申请已提交，待净值确认后生效')
  closeForm(code)
  d.amount = ''
}

function submitReduce(code: string): void {
  const d = formData[code]
  const nav = getReferenceNav(code)
  if (!d.shares || d.shares <= 0) { ElMessage.warning('请输入有效份额'); return }
  if (nav <= 0) { ElMessage.warning('当前净值不可用'); return }
  const delayDays = fundStore.getValuation(code)?.delayDays ?? 1
  holdingStore.createPendingReduce(code, d.shares, nav, delayDays)
  ElMessage.success('减仓申请已提交，待净值确认后生效')
  closeForm(code)
  d.shares = ''
}

function submitEdit(code: string): void {
  const d = formData[code]
  if (!d.holdingAmount || d.holdingAmount <= 0) { ElMessage.warning('请输入持仓金额'); return }
  const nav = getReferenceNav(code)
  const refNav = nav > 0 ? nav : 1
  const estimatedShares = d.holdingAmount / refNav
  const v = fundStore.getValuation(code)

  const profit = d.totalProfit === '' ? 0 : d.totalProfit
  const principal = d.holdingAmount - profit
  const costNav = estimatedShares > 0 && principal > 0 ? principal / estimatedShares : refNav

  holdingStore.replaceHoldingDirect(
    code, estimatedShares, costNav, d.holdingAmount,
    profit,
    { gszzl: v?.gszzl, isEstimated: v?.isEstimated, jzrq: v?.jzrq },
    findDateByNav(peekNavSeries(code), costNav),
  )
  ElMessage.success('持仓已更新')
  closeForm(code)
}

async function confirmClearHolding(code: string): Promise<void> {
  const name = fundStore.resolveFundName(code)
  const ok = await confirm({
    title: '清空持仓',
    desc: `确认清空「${name}」的持仓数据？`,
    confirmText: '确认清空',
    cancelText: '取消',
  })
  if (!ok) return
  holdingStore.settleAllByFund(code)
  closeForm(code)
  ElMessage.success('已清空持仓')
}

async function confirmDelete(code: string): Promise<void> {
  const name = fundStore.resolveFundName(code)
  const ok = await confirm({
    title: '删除确认',
    desc: `确认从当前分组删除「${name}」？该分组下的持仓数据将一并清除。`,
    confirmText: '确认删除',
    cancelText: '取消',
  })
  if (!ok) return
  removeFundFromActiveGroup(code)
  const idx = selectedCodes.value.indexOf(code)
  if (idx >= 0) selectedCodes.value.splice(idx, 1)
  ElMessage.success('已删除')
}
</script>
<style scoped>
.manage-page {
  display: flex;
  flex-direction: column;

  height: 100%;
  overflow: hidden;
  padding: var(--spacing-md);
  gap: var(--spacing-md);
}

.mg-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-shrink: 0;
}
.mg-back {
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
.mg-back:hover { background: var(--bg-card-hover); color: var(--text-primary); }

.mg-title-wrap { display: flex; flex-direction: column; gap: 1px; flex: 1; min-width: 0; }
.mg-title { font-size: var(--font-lg); font-weight: 700; color: var(--text-primary); margin: 0; }
.mg-sub { font-size: var(--font-xs); color: var(--text-muted); }

.mg-select-toggle {
  padding: 6px 14px;
  border-radius: var(--radius-full);
  border: 1px solid var(--border-default);
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--font-xs);
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
  transition: background-color var(--transition-fast), border-color var(--transition-fast),
              color var(--transition-fast);
}
.mg-select-toggle:hover { border-color: var(--border-hover); color: var(--text-primary); }
.mg-select-toggle.on {
  background: var(--color-primary);
  border-color: transparent;
  color: var(--color-on-primary);
}

.mg-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.mg-cards {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);

  padding-bottom: 88px;
}

.mg-card {
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  overflow: hidden;
  transition: border-color var(--transition-fast), background-color var(--transition-fast);
}
.mg-card.is-selectable { cursor: pointer; }
.mg-card.selected {
  border-color: var(--color-primary);
  background: var(--color-primary-glow);
}

.mg-card-head {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
}

.mg-mark {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  font-size: var(--font-md);
  font-weight: 700;
  line-height: 1;
}

.mg-check {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-full);
  border: 2px solid var(--border-hover);
  color: var(--color-on-primary);
  transition: background-color var(--transition-fast), border-color var(--transition-fast);
}
.mg-check.on {
  background: var(--color-primary);
  border-color: var(--color-primary);
}

.mg-ident { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.mg-name {
  font-size: var(--font-sm);
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mg-code {
  font-size: 11px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  align-self: flex-start;
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  background: var(--border-subtle);
}

.mg-figures {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}
.mg-amount {
  font-size: var(--font-sm);
  font-weight: 600;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}
.mg-amount-none { color: var(--text-muted); font-weight: 500; }
.mg-profit { font-size: 11px; font-weight: 600; font-variant-numeric: tabular-nums; }

.mg-ops {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: var(--spacing-sm) var(--spacing-md);
  border-top: 1px solid var(--border-subtle);
  background: var(--bg-surface);
  flex-wrap: wrap;
}
.mg-ops-spacer { flex: 1; }
.mg-op {
  padding: 5px 12px;
  border-radius: var(--radius-full);
  border: 1px solid var(--border-default);
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--font-xs);
  font-weight: 600;
  cursor: pointer;
  transition: background-color var(--transition-fast), border-color var(--transition-fast),
              color var(--transition-fast);
}
.mg-op:hover { background: var(--bg-card-hover); border-color: var(--border-hover); color: var(--text-primary); }
.mg-op.on {
  background: var(--color-primary-glow);
  border-color: var(--color-primary);
  color: var(--color-primary);
}
.mg-op-primary {
  background: var(--color-primary);
  border-color: transparent;
  color: var(--color-on-primary);
}
.mg-op-primary:hover { background: var(--color-primary-light); color: var(--color-on-primary); }
.mg-op-danger {
  display: inline-flex;
  align-items: center;
  padding: 5px 10px;
  color: var(--text-muted);
}
.mg-op-danger:hover {
  background: var(--color-rise-glow);
  border-color: var(--color-rise);
  color: var(--color-rise);
}

.mg-form-wrap {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows var(--duration-fast) var(--ease-out-expo);
}
.mg-form-wrap.open { grid-template-rows: 1fr; }
.mg-form-clip { overflow: hidden; min-height: 0; }

.mg-form-wrap.open { border-top: 1px solid var(--border-subtle); }
.mg-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
}

.mg-field { display: flex; flex-direction: column; gap: 5px; }
.mg-label { font-size: var(--font-xs); color: var(--text-muted); font-weight: 500; }
.mg-input-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 var(--spacing-sm);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
  background: var(--bg-input);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}
.mg-input-wrap:focus-within {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-glow);
}
.mg-unit { font-size: var(--font-sm); color: var(--text-muted); flex-shrink: 0; }
.mg-unit-suffix { margin-left: auto; }
.mg-input {
  flex: 1;
  min-width: 0;
  padding: 9px 0;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: var(--font-md);
  font-variant-numeric: tabular-nums;
  outline: none;
}

.mg-input::-webkit-outer-spin-button,
.mg-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.mg-input[type=number] { -moz-appearance: textfield; }

.mg-hint { font-size: var(--font-xs); color: var(--text-muted); margin: 0; }

.mg-form-acts { display: flex; gap: var(--spacing-sm); margin-top: 2px; }
.mg-fbtn {
  flex: 1;
  padding: 9px var(--spacing-md);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--font-sm);
  font-weight: 600;
  cursor: pointer;
  transition: background-color var(--transition-fast), border-color var(--transition-fast),
              color var(--transition-fast);
}
.mg-fbtn:hover { background: var(--bg-card-hover); border-color: var(--border-hover); color: var(--text-primary); }
.mg-fbtn-primary {
  background: var(--color-primary);
  border-color: transparent;
  color: var(--color-on-primary);
}
.mg-fbtn-primary:hover { background: var(--color-primary-light); color: var(--color-on-primary); }
.mg-fbtn-danger {
  background: var(--color-rise);
  border-color: transparent;
  color: #fff;
}
.mg-fbtn-danger:hover { background: var(--color-rise-light); color: #fff; }

.mg-batch {
  position: fixed;
  left: var(--spacing-md);
  right: var(--spacing-md);
  bottom: calc(var(--spacing-md) + env(safe-area-inset-bottom, 0px));
  margin: 0 auto;
  max-width: 560px;
  z-index: var(--z-fixed);
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-full);
}
.mg-batch-all {
  padding: 5px 12px;
  border-radius: var(--radius-full);
  border: 1px solid var(--border-default);
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--font-xs);
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}
.mg-batch-all:hover { color: var(--text-primary); border-color: var(--border-hover); }
.mg-batch-count { font-size: var(--font-xs); color: var(--text-muted); white-space: nowrap; }
.mg-batch .mg-fbtn { flex: 0 0 auto; padding: 6px 14px; font-size: var(--font-xs); }

.mg-batch-enter-active,
.mg-batch-leave-active {
  transition: opacity var(--duration-fast) var(--ease-out-expo),
              transform var(--duration-fast) var(--ease-out-expo);
}
.mg-batch-enter-from,
.mg-batch-leave-to { opacity: 0; transform: translate3d(0, 16px, 0); }

.mg-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-2xl) var(--spacing-md);
  text-align: center;
}

@media (max-width: 767px) {
  .manage-page { padding: var(--spacing-sm); }
  .mg-card-head { padding: var(--spacing-sm) var(--spacing-md); }
  .mg-ops { gap: 5px; }
  .mg-op { padding: 5px 10px; }
}
</style>
