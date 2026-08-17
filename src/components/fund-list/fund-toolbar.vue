<template>
  <div class="fund-toolbar" ref="rootEl">
    <button
      type="button"
      class="tb-view-switch"
      :title="`切换到${otherView.label}视图`"
      @click="$emit('changeViewMode', otherView.mode)"
    >
      <span class="tb-view-icon" v-html="currentView.icon" />
      <span class="tb-view-label">{{ currentView.label }}</span>
      <span class="tb-view-swap" aria-hidden="true">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
          <polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
        </svg>
      </span>
    </button>
    <button
      type="button"
      class="tb-group-switch"
      :class="{ active: panel === 'group' }"
      title="切换分组"
      @click="togglePanel('group')"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
        <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
      </svg>
      <span class="tb-group-name">{{ groupStore.activeGroup?.name || '分组' }}</span>
      <span class="tb-group-count font-number">{{ groupStore.activeCodes.length }}</span>
    </button>
    <div class="tb-spacer" />
    <RefreshControl
      toggle-key="autoRefresh"
      interval-key="refreshInterval"
      :options="[5, 10, 15, 30, 60, 120]"
    />
    <div class="tb-actions">
      <button
        type="button"
        class="tb-icon"
        :class="{ active: panel === 'sort' }"
        title="排序"
        @click="togglePanel('sort')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="14" y2="12" /><line x1="4" y1="18" x2="9" y2="18" />
        </svg>
      </button>
      <button
        type="button"
        class="tb-icon"
        :class="{ active: panel === 'privacy' }"
        :title="privacyTitle"
        @click="togglePanel('privacy')"
      >
        <svg v-if="privacyState === 'all-visible'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
        </svg>
        <svg v-else-if="privacyState === 'all-hidden'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>
        </svg>
        <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/><line x1="3" y1="21" x2="21" y2="3" stroke-dasharray="3 3"/>
        </svg>
      </button>
      <button type="button" class="tb-icon tb-primary" title="基金管理" @click="$emit('openManage')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
    <Transition name="tb-panel">
      <div v-if="panel" class="tb-panel surface-card" @click.stop>
        <template v-if="panel === 'sort'">
          <div class="tb-panel-head">
            <span class="tb-panel-title">排序方式</span>
            <span class="tb-panel-hint">{{ sortDirection === 'desc' ? '从高到低' : '从低到高' }}</span>
          </div>
          <div class="tb-sort-grid">
            <button
              v-for="opt in sortFields"
              :key="opt.field"
              type="button"
              class="tb-sort-item"
              :class="{ active: sortField === opt.field }"
              @click="$emit('changeSortField', opt.field)"
            >
              <span>{{ opt.label }}</span>
              <span v-if="sortField === opt.field" class="tb-sort-dir" :class="{ 'is-asc': sortDirection === 'asc' }">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </span>
            </button>
          </div>
        </template>
        <template v-else-if="panel === 'privacy'">
          <div class="tb-panel-head">
            <span class="tb-panel-title">隐私显示</span>
            <div class="tb-panel-acts">
              <button type="button" class="tb-mini" @click="settingsStore.showAllPrivacy()">全显</button>
              <button type="button" class="tb-mini" @click="settingsStore.hideAllPrivacy()">全隐</button>
            </div>
          </div>
          <div class="tb-privacy-grid">
            <button
              v-for="item in PRIVACY_ITEMS"
              :key="item.key"
              type="button"
              class="tb-chip"
              :class="{ on: settingsStore.privacy[item.key] }"
              @click="togglePrivacy(item.key)"
            >
              {{ item.label }}
            </button>
          </div>
        </template>
        <template v-else-if="panel === 'group'">
          <div class="tb-panel-head">
            <span class="tb-panel-title">基金分组</span>
            <div class="tb-panel-acts">
              <button type="button" class="tb-mini" :class="{ on: managing }" @click="toggleManage">
                {{ managing ? '完成' : '管理' }}
              </button>
              <button type="button" class="tb-mini" @click="startCreate">＋ 新建</button>
            </div>
          </div>
          <div v-if="creating" class="tb-group-create">
            <input
              ref="createInputRef"
              v-model="draftName"
              class="tb-group-input"
              placeholder="分组名称"
              maxlength="12"
              @keydown.enter="submitCreate"
              @keydown.escape="cancelCreate"
            />
            <button type="button" class="tb-mini" @click="submitCreate">确定</button>
            <button type="button" class="tb-mini" @click="cancelCreate">取消</button>
          </div>
          <p v-if="managing" class="tb-panel-hint tb-manage-hint">编辑名称、清空分组内基金或删除整个分组</p>
          <div class="tb-group-list">
            <div
              v-for="g in groupStore.sortedGroups"
              :key="g.id"
              class="tb-group-item"
              :class="{ active: !managing && g.id === groupStore.activeGroupId }"
            >
              <template v-if="renamingId === g.id">
                <input
                  ref="renameInputRef"
                  v-model="draftName"
                  class="tb-group-input"
                  maxlength="12"
                  @keydown.enter="submitRename(g.id)"
                  @keydown.escape="cancelRename"
                />
                <button type="button" class="tb-mini" @click="submitRename(g.id)">确定</button>
                <button type="button" class="tb-mini" @click="cancelRename">取消</button>
              </template>
              <template v-else-if="managing">
                <span class="tb-group-pick tb-group-pick-static">
                  <span class="tb-group-label">{{ g.name }}</span>
                  <span class="tb-group-num font-number">{{ groupStore.getMembers(g.id).length }}</span>
                </span>
                <button type="button" class="tb-group-op" title="重命名" @click.stop="startRename(g)">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
                  </svg>
                </button>
                <button
                  type="button"
                  class="tb-group-op"
                  title="清空分组"
                  :disabled="groupStore.getMembers(g.id).length === 0"
                  @click.stop="askClearGroup(g)"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M10 11v6"/><path d="M14 11v6"/>
                  </svg>
                </button>
                <button
                  v-if="!g.builtin"
                  type="button"
                  class="tb-group-op tb-group-op-danger"
                  title="删除分组"
                  @click.stop="askDeleteGroup(g)"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                </button>
                <span v-else class="tb-group-lock" title="预置分组不可删除">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>
                  </svg>
                </span>
              </template>
              <template v-else>
                <button type="button" class="tb-group-pick" @click="pickGroup(g.id)">
                  <span class="tb-group-label">{{ g.name }}</span>
                  <span class="tb-group-num font-number">{{ groupStore.getMembers(g.id).length }}</span>
                </button>
              </template>
            </div>
          </div>
        </template>
      </div>
    </Transition>
  </div>
</template>
<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useSettingsStore } from '@/modules/settings/settings-store'
import { useGroupStore } from '@/modules/group/group-store'
import type { FundGroup } from '@/modules/group/group-types'
import { purgeGroup, clearGroup } from '@/modules/group/group-actions'
import { confirm } from '@/composables/use-confirm'
import type { PrivacySettings } from '@/modules/settings/settings-store'
import type { ViewMode, SortField, SortDirection } from '@/modules/fund/fund-types'
import RefreshControl from '@/components/shared/refresh-control.vue'

const props = defineProps<{
  viewMode: ViewMode
  sortField: SortField
  sortDirection: SortDirection
  sortFields: { label: string; field: SortField }[]
}>()

defineEmits<{
  changeViewMode: [mode: ViewMode]
  changeSortField: [field: SortField]
  openManage: []
}>()

const settingsStore = useSettingsStore()
const groupStore = useGroupStore()
const rootEl = ref<HTMLElement | null>(null)

const ICON_ATTRS = 'width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'
const VIEWS: { mode: ViewMode; label: string; icon: string }[] = [
  {
    mode: 'table',
    label: '表格',
    icon: `<svg ${ICON_ATTRS}><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="4" x2="9" y2="20"/><rect x="3" y="4" width="18" height="16" rx="2"/></svg>`,
  },
  {
    mode: 'card',
    label: '卡片',
    icon: `<svg ${ICON_ATTRS}><rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="6" rx="2"/></svg>`,
  },
]

const currentView = computed(() => VIEWS.find(v => v.mode === props.viewMode) ?? VIEWS[0])
const otherView = computed(() => VIEWS.find(v => v.mode !== props.viewMode) ?? VIEWS[1])

const PRIVACY_ITEMS: { key: keyof PrivacySettings; label: string }[] = [
  { key: 'holding', label: '持仓金额' },
  { key: 'todayProfit', label: '今日收益' },
  { key: 'totalProfit', label: '累计收益' },
  { key: 'todayRate', label: '今日收益率' },
  { key: 'totalRate', label: '累计收益率' },
]

const panel = ref<'sort' | 'privacy' | 'group' | null>(null)

function togglePanel(p: 'sort' | 'privacy' | 'group'): void {
  panel.value = panel.value === p ? null : p
  if (panel.value !== 'group') { cancelCreate(); cancelRename(); managing.value = false }
}

const managing = ref(false)

function toggleManage(): void {
  managing.value = !managing.value
  cancelCreate()
  cancelRename()
}

const creating = ref(false)
const renamingId = ref<string | null>(null)
const draftName = ref('')
const createInputRef = ref<HTMLInputElement | null>(null)
const renameInputRef = ref<HTMLInputElement | null>(null)

function startCreate(): void {
  cancelRename()
  creating.value = true
  draftName.value = ''
  void nextTick(() => createInputRef.value?.focus())
}

function cancelCreate(): void {
  creating.value = false
  draftName.value = ''
}

function submitCreate(): void {
  const g = groupStore.createGroup(draftName.value)
  if (!g) { ElMessage.warning('请输入分组名称'); return }
  groupStore.setActiveGroup(g.id)
  cancelCreate()
  ElMessage.success(`已创建「${g.name}」`)
}

function startRename(g: FundGroup): void {
  cancelCreate()
  renamingId.value = g.id
  draftName.value = g.name
  void nextTick(() => renameInputRef.value?.focus())
}

function cancelRename(): void {
  renamingId.value = null
  draftName.value = ''
}

function submitRename(id: string): void {
  if (!groupStore.renameGroup(id, draftName.value)) {
    ElMessage.warning('请输入分组名称')
    return
  }
  cancelRename()
}

function pickGroup(id: string): void {
  groupStore.setActiveGroup(id)
  panel.value = null
}

async function askClearGroup(g: FundGroup): Promise<void> {
  const count = groupStore.getMembers(g.id).length
  if (count === 0) return
  const ok = await confirm({
    title: `清空分组「${g.name}」`,
    desc: `将移出该分组下全部 ${count} 只基金及其持仓记录，分组本身保留。其他分组的同名基金不受影响。`,
    confirmText: '确认清空',
    cancelText: '取消',
  })
  if (!ok) return
  clearGroup(g.id)
  ElMessage.success(`已清空「${g.name}」`)
}

async function askDeleteGroup(g: FundGroup): Promise<void> {
  const count = groupStore.getMembers(g.id).length
  const ok = await confirm({
    title: `删除分组「${g.name}」`,
    desc: count > 0
      ? `该分组下 ${count} 只基金及其持仓记录将一并删除，且不可恢复。其他分组的同名基金不受影响。`
      : '确认删除该分组？',
    confirmText: '确认删除',
    cancelText: '取消',
  })
  if (!ok) return
  purgeGroup(g.id)
  ElMessage.success('已删除分组')
}

function togglePrivacy(key: keyof PrivacySettings): void {
  settingsStore.privacy[key] = !settingsStore.privacy[key]
}

const privacyState = computed(() => {
  const vals = PRIVACY_ITEMS.map(i => settingsStore.privacy[i.key])
  if (vals.every(Boolean)) return 'all-visible'
  if (vals.every(v => !v)) return 'all-hidden'
  return 'partial'
})
const privacyTitle = computed(() => (
  privacyState.value === 'all-visible' ? '隐私：全部显示'
    : privacyState.value === 'all-hidden' ? '隐私：全部隐藏'
      : '隐私：部分隐藏'
))

function onDocPointerDown(e: PointerEvent): void {
  if (!panel.value) return
  const el = rootEl.value
  if (el && !el.contains(e.target as Node)) panel.value = null
}
function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') panel.value = null
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocPointerDown)
  document.addEventListener('keydown', onKeydown)
})
onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocPointerDown)
  document.removeEventListener('keydown', onKeydown)
})
</script>
<style scoped>
.fund-toolbar {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-shrink: 0;
  padding: var(--spacing-xs) 0;
}

.tb-spacer { flex: 1; }

.tb-group-switch {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px 6px 11px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-full);
  background: var(--bg-card);
  color: var(--text-secondary);
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  max-width: 42vw;
  transition: background-color var(--transition-fast), border-color var(--transition-fast),
              color var(--transition-fast);
}
.tb-group-switch:hover {
  background: var(--bg-card-hover);
  border-color: var(--border-hover);
  color: var(--text-primary);
}
.tb-group-switch:active { transform: scale(0.97); }
.tb-group-switch.active {
  background: var(--color-primary-glow);
  border-color: var(--color-primary);
  color: var(--color-primary);
}
.tb-group-name {
  font-size: var(--font-xs);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tb-group-count {
  font-size: 10px;
  color: var(--text-muted);
  padding: 1px 6px;
  border-radius: var(--radius-full);
  background: var(--bg-base);
}
.tb-group-switch.active .tb-group-count { color: var(--color-primary); }

.tb-group-create {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: var(--spacing-sm);
}

.tb-group-input {
  flex: 1;
  min-width: 0;
  padding: 5px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-default);
  background: var(--bg-base);
  color: var(--text-primary);
  font-size: var(--font-xs);
  outline: none;
}
.tb-group-input:focus { border-color: var(--color-primary); }

.tb-group-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 240px;
  overflow-y: auto;
}

.tb-group-item {
  display: flex;
  align-items: center;
  gap: 4px;
  border-radius: var(--radius-sm);
  padding: 2px 4px 2px 0;
  transition: background-color var(--transition-fast);
}
.tb-group-item:hover { background: var(--bg-card-hover); }
.tb-group-item.active { background: var(--color-primary-glow); }

.tb-group-pick {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-xs);
  padding: 7px var(--spacing-sm);
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--font-xs);
  cursor: pointer;
  text-align: left;
}
.tb-group-pick-static { cursor: default; }
.tb-manage-hint { margin: 0 0 var(--spacing-xs); }
.tb-mini.on {
  color: var(--color-primary);
  border-color: var(--color-primary);
}
.tb-group-lock {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  color: var(--text-muted);
  opacity: 0.45;
  flex-shrink: 0;
}
.tb-group-item.active .tb-group-pick { color: var(--color-primary); font-weight: 600; }
.tb-group-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tb-group-num { font-size: 10px; color: var(--text-muted); flex-shrink: 0; }

.tb-group-op {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  flex-shrink: 0;
  transition: color var(--transition-fast), background-color var(--transition-fast);
}
.tb-group-op:hover { color: var(--text-primary); background: var(--bg-base); }
.tb-group-op:disabled { opacity: 0.35; cursor: not-allowed; }
.tb-group-op:disabled:hover { color: var(--text-muted); background: transparent; }
.tb-group-op-danger:hover { color: var(--color-fall); }

.tb-view-switch {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 6px 12px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-full);
  background: var(--bg-card);
  color: var(--text-secondary);
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: background-color var(--transition-fast), border-color var(--transition-fast),
              color var(--transition-fast);
}
.tb-view-switch:hover {
  background: var(--bg-card-hover);
  border-color: var(--border-hover);
  color: var(--text-primary);
}
.tb-view-switch:active { transform: scale(0.97); }
.tb-view-icon { display: inline-flex; }
.tb-view-label { font-size: var(--font-xs); font-weight: 600; }

.tb-view-swap {
  display: inline-flex;
  color: var(--text-muted);
  margin-left: 1px;
}

.tb-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}.tb-icon {
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
  transition: background-color var(--transition-fast), border-color var(--transition-fast),
              color var(--transition-fast), transform var(--transition-fast);
}
.tb-icon:hover {
  background: var(--bg-card-hover);
  border-color: var(--border-hover);
  color: var(--text-primary);
}
.tb-icon:active { transform: scale(0.92); }
.tb-icon.active {
  background: var(--color-primary-glow);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.tb-primary {
  background: var(--color-primary);
  border-color: transparent;
  color: var(--color-on-primary);
}
.tb-primary:hover {
  background: var(--color-primary-light);
  border-color: transparent;
  color: var(--color-on-primary);
}

.tb-panel {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  left: 0;
  z-index: var(--z-popover);
  padding: var(--spacing-md);
  box-shadow: var(--shadow-lg);
}
.tb-panel:hover {
  background: var(--bg-card);
  border-color: var(--border-default);
}

.tb-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-sm);
}
.tb-panel-title { font-size: var(--font-sm); font-weight: 600; color: var(--text-primary); }
.tb-panel-hint { font-size: var(--font-xs); color: var(--text-muted); }
.tb-panel-acts { display: flex; gap: var(--spacing-xs); }
.tb-mini {
  padding: 3px 10px;
  border-radius: var(--radius-full);
  border: 1px solid var(--border-default);
  background: transparent;
  color: var(--text-muted);
  font-size: var(--font-xs);
  cursor: pointer;
  transition: color var(--transition-fast), border-color var(--transition-fast);
}
.tb-mini:hover { color: var(--text-primary); border-color: var(--border-hover); }

.tb-sort-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 4px;
}
.tb-sort-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-xs);
  padding: 7px var(--spacing-sm);
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--font-xs);
  cursor: pointer;
  text-align: left;
  transition: background-color var(--transition-fast), color var(--transition-fast);
}
.tb-sort-item:hover { background: var(--bg-card-hover); color: var(--text-primary); }
.tb-sort-item.active {
  background: var(--color-primary-glow);
  color: var(--color-primary);
  font-weight: 600;
}
.tb-sort-dir {
  display: inline-flex;
  transition: transform var(--transition-fast);
  flex-shrink: 0;
}
.tb-sort-dir.is-asc { transform: rotate(180deg); }

.tb-privacy-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.tb-chip {
  padding: 5px 12px;
  border-radius: var(--radius-full);
  border: 1px solid var(--border-default);
  background: transparent;
  color: var(--text-muted);
  font-size: var(--font-xs);
  cursor: pointer;
  transition: background-color var(--transition-fast), color var(--transition-fast),
              border-color var(--transition-fast);
}
.tb-chip:hover { border-color: var(--border-hover); color: var(--text-secondary); }
.tb-chip.on {
  background: var(--color-accent-soft);
  border-color: transparent;
  color: var(--color-accent);
  font-weight: 600;
}

.tb-panel-enter-active,
.tb-panel-leave-active {
  transition: opacity var(--duration-fast) var(--ease-out-expo),
              transform var(--duration-fast) var(--ease-out-expo);
}
.tb-panel-enter-from,
.tb-panel-leave-to {
  opacity: 0;
  transform: translate3d(0, -6px, 0);
}

@media (max-width: 767px) {
  .tb-view-switch { padding: 5px 10px; }
  .tb-view-switch .tb-view-label { display: none; }
  .tb-group-switch { padding: 5px 9px 5px 10px; max-width: 46vw; }
  .tb-icon { width: 32px; height: 32px; }
  .tb-sort-grid { grid-template-columns: 1fr 1fr; }
}
</style>
