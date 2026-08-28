<template>
  <Teleport to="body">
    <Transition name="overlay" @after-leave="onAfterLeave">
      <div v-if="expanded" class="search-overlay" @mousedown.self="collapse">
        <div class="search-expanded-wrap">
          <div class="search-expanded-glow"></div>
          <div class="search-expanded" ref="expandedRef" :style="expandedStyle">
            <div class="expanded-input">
              <el-icon class="search-icon" :size="18"><Search /></el-icon>
              <input
                ref="expandedInputRef"
                v-model="searchKeyword"
                placeholder=""
                class="expanded-search-input"
                @keydown.escape="collapse"
              />
              <button v-if="searchKeyword" class="clear-btn" @mousedown.prevent="clearAndFocus">
                <el-icon :size="14"><Close /></el-icon>
              </button>
              <div class="divider"></div>
              <button class="camera-btn" @click="triggerFileSelect" title="识图导入">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </button>
              <input ref="fileInput" type="file" accept="image/*" multiple class="hidden-file-input" @change="handleFileSelect" />
            </div>
            <div v-if="isRecognizing && imageFunds.length === 0" class="recognition-loading">
              <span class="animate-breathe">正在识别图片中...</span>
              <button class="btn-text" @click="handleCancelRecognition">取消</button>
            </div>
            <div v-if="imageFunds.length > 0 || recognitionStatus === 'error'" class="image-section">
              <div class="image-header">
                <span class="image-label">{{ imageFunds.length > 0 ? `识别到 ${imageFunds.length} 个基金` : '识别结果' }}</span>
                <button v-if="!isRecognizing" class="btn-text" @click="resetRecognition">清除</button>
                <button v-else class="btn-text" @click="handleCancelRecognition">取消</button>
              </div>
              <div class="recognized-list">
                <div v-for="fund in imageFunds" :key="fund.fundCode" class="recognized-item" :class="{ 'is-existing': fundStore.fundCodes.includes(fund.fundCode) }">
                  <span class="font-number recognized-code">{{ fund.fundCode }}</span>
                  <span class="recognized-name">{{ fund.fundName }}</span>
                  <span v-if="fund.holdingAmount != null" class="font-number recognized-amount">{{ fund.holdingAmount.toFixed(2) }}</span>
                  <span v-if="fund.holdingProfit != null" class="font-number recognized-profit" :class="fund.holdingProfit > 0 ? 'text-profit' : fund.holdingProfit < 0 ? 'text-loss' : ''">{{ fund.holdingProfit > 0 ? '+' : '' }}{{ fund.holdingProfit.toFixed(2) }}</span>
                  <span v-if="fundStore.fundCodes.includes(fund.fundCode)" class="recognized-tag">已关注</span>
                  <button
                    type="button"
                    class="item-remove"
                    :title="`移除 ${fund.fundName}`"
                    @mousedown.prevent.stop="removeRecognized(fund.fundCode)"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              </div>
              <div v-if="isRecognizing" class="progress-bar">
                <div class="progress-fill" :style="{ width: `${(progress.done / progress.total) * 100}%` }"></div>
                <span class="progress-text font-number">{{ progress.done }}/{{ progress.total }}</span>
              </div>
              <div v-if="recognitionError" class="recognition-error">{{ recognitionError }}</div>
              <GroupPickerBar
                v-if="imageFunds.length > 0"
                :count="importableCount"
                :disabled="importableCount === 0"
                @pick="handleBatchAdd"
              />
            </div>
            <div v-if="searchResults.length > 0" class="result-list">
              <div
                v-for="item in searchResults"
                :key="item.fundCode"
                class="result-item"
                :class="{ 'is-picked': pickedCodes.includes(item.fundCode) }"
                @mousedown.prevent="togglePick(item)"
              >
                <span class="result-check" :class="{ on: pickedCodes.includes(item.fundCode) }">
                  <svg v-if="pickedCodes.includes(item.fundCode)" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </span>
                <span class="result-code font-number">{{ item.fundCode }}</span>
                <span class="result-name">{{ item.fundName }}</span>
                <span class="result-type">{{ item.fundType }}</span>
              </div>
            </div>
            <div v-if="pickedCodes.length > 0" class="picked-section">
              <div class="picked-chips">
                <span
                  v-for="code in pickedCodes"
                  :key="`picked-${code}`"
                  class="picked-chip"
                  :class="{ 'is-existing': fundStore.fundCodes.includes(code) }"
                >
                  <span class="picked-chip-name">{{ fundStore.getFundName(code) || fundStore.resolveFundName(code) || code }}</span>
                  <button
                    type="button"
                    class="picked-chip-x"
                    title="移除"
                    @mousedown.prevent.stop="unpick(code)"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </span>
                <button class="picked-clear" @mousedown.prevent="pickedCodes = []">清空</button>
              </div>
            </div>
            <GroupPickerBar
              v-if="pickedCodes.length > 0"
              :count="pickedCodes.length"
              @pick="addPickedToGroup"
            />
            <div v-if="searching" class="dropdown-empty">
              <span class="animate-breathe">搜索中...</span>
            </div>
            <div v-else-if="searchKeyword.length >= 2 && !searching && imageFunds.length === 0 && searchResults.length === 0" class="dropdown-empty">
              未找到匹配基金
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
  <button class="search-mini" ref="triggerRef" title="搜索基金 / 识图导入" @click="expand">
    <div class="search-glow"></div>
    <el-icon class="search-icon" :size="15"><Search /></el-icon>
  </button>
</template>
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { Search, Close } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

import { useFundSearch } from '@/composables/use-fund-search'
import { useImageRecognition } from '@/composables/use-image-recognition'
import { useFundStore } from '@/modules/fund/fund-store'
import { useGroupStore } from '@/modules/group/group-store'
import GroupPickerBar from '@/components/search/group-picker-bar.vue'
import type { SearchResult } from '@/modules/fund/fund-types'
import type { RecognizedFund } from '@/modules/ai/ai-types'

const fundStore = useFundStore()
const groupStore = useGroupStore()
const { keyword, results, searching, clearSearch } = useFundSearch()
const {
  recognizedFunds: imageFunds,
  status: recognitionStatus,
  progress,
  errorMessage: recognitionError,
  recognizeImages,
  cancelRecognition,
  importRecognized,
  resetRecognition,
} = useImageRecognition()

const triggerRef = ref<HTMLElement | null>(null)
const expandedRef = ref<HTMLElement | null>(null)
const expandedInputRef = ref<HTMLInputElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

const expanded = ref(false)
const animating = ref(false)

const originRect = ref<{ left: number; top: number; width: number; height: number } | null>(null)

const searchKeyword = computed({
  get: () => keyword.value,
  set: (val) => { keyword.value = val },
})

const searchResults = computed(() => results.value)

const isRecognizing = computed(() => recognitionStatus.value === 'reading' || recognitionStatus.value === 'recognizing')

const expandedStyle = computed(() => {
  if (!originRect.value || !animating.value) return {}
  const r = originRect.value
  return {
    '--origin-left': `${r.left}px`,
    '--origin-top': `${r.top}px`,
    '--origin-width': `${r.width}px`,
    '--origin-height': `${r.height}px`,
  }
})

function expand(): void {
  if (expanded.value) return
  if (triggerRef.value) {
    originRect.value = triggerRef.value.getBoundingClientRect()
  }
  expanded.value = true
  animating.value = true
  nextTick(() => {
    expandedInputRef.value?.focus()
    setTimeout(() => { animating.value = false }, 500)
  })
}

function collapse(): void {
  if (triggerRef.value) {
    originRect.value = triggerRef.value.getBoundingClientRect()
  }
  animating.value = true
  expanded.value = false
}

function onAfterLeave(): void {
  animating.value = false
  clearSearch()
  resetRecognition()
  pickedCodes.value = []
}

function handleGlobalKeydown(e: KeyboardEvent): void {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault()
    if (expanded.value) collapse()
    else expand()
  }
  if (e.key === 'Escape' && expanded.value) {
    e.preventDefault()
    collapse()
  }
}

function handleGlobalPaste(e: ClipboardEvent): void {
  if (!expanded.value) return
  const items = e.clipboardData?.items
  if (!items) return
  const imageFiles: File[] = []
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (file) imageFiles.push(file)
    }
  }
  if (imageFiles.length > 0) {
    e.preventDefault()
    recognizeImages(imageFiles)
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleGlobalKeydown)
  document.addEventListener('paste', handleGlobalPaste)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleGlobalKeydown)
  document.removeEventListener('paste', handleGlobalPaste)
})

function clearAndFocus(): void {
  clearSearch()
  nextTick(() => expandedInputRef.value?.focus())
}

function triggerFileSelect(): void {
  fileInput.value?.click()
}

function handleFileSelect(e: Event): void {
  const target = e.target as HTMLInputElement
  const files = target.files
  if (files && files.length > 0) {
    recognizeImages(Array.from(files))
  }
  target.value = ''
}

async function handleBatchAdd(groupId: string): Promise<void> {
  const count = await importRecognized(groupId)
  if (count > 0) {
    const name = groupStore.groups.find(g => g.id === groupId)?.name ?? '分组'
    ElMessage.success(`已添加 ${count} 个基金到「${name}」`)
    resetRecognition()
    clearSearch()
  } else {
    ElMessage.warning('没有新的基金可添加')
  }
}

function handleCancelRecognition(): void {
  cancelRecognition()
  resetRecognition()
}

const pickedCodes = ref<string[]>([])

const importableCount = computed(() =>
  imageFunds.value.filter((f: RecognizedFund) => !groupStore.getMembers(groupStore.activeGroupId).includes(f.fundCode)).length,
)

function togglePick(item: SearchResult): void {
  const picked = pickedCodes.value
  pickedCodes.value = picked.includes(item.fundCode)
    ? picked.filter(c => c !== item.fundCode)
    : [...picked, item.fundCode]

  if (item.fundName) fundStore.setFundName(item.fundCode, item.fundName)
}

function unpick(code: string): void {
  pickedCodes.value = pickedCodes.value.filter(c => c !== code)
}

function removeRecognized(code: string): void {
  imageFunds.value = imageFunds.value.filter((f: RecognizedFund) => f.fundCode !== code)
}

async function addPickedToGroup(groupId: string): Promise<void> {
  const codes = [...pickedCodes.value]
  if (codes.length === 0) return

  const before = groupStore.getMembers(groupId).length
  for (const code of codes) fundStore.addFund(code, fundStore.getFundName(code) || undefined, groupId)
  const added = groupStore.getMembers(groupId).length - before

  const name = groupStore.groups.find(g => g.id === groupId)?.name ?? '分组'
  if (added > 0) ElMessage.success(`已添加 ${added} 只基金到「${name}」`)
  else ElMessage.warning(`选中的基金已在「${name}」中`)

  pickedCodes.value = []
  collapse()

  for (const code of codes) void fundStore.fetchValuation(code)
}
</script>
<style scoped>

.search-mini {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  flex-shrink: 0;
  transition: background-color var(--transition-fast), border-color var(--transition-fast),
              color var(--transition-fast);
}
.search-mini:hover {
  background: var(--bg-card-hover);
  border-color: var(--border-hover);
  color: var(--color-primary);
}
.search-mini .search-icon { position: relative; z-index: 1; }

.search-mini .search-glow { border-radius: var(--radius-full); }

/* 首页 header 常驻，不能让它一直占着主线程：
   原先 background-position + filter: blur 每帧都要重绘并重做高斯模糊。
   静止时只留一层静态渐变，交互时才转起来 —— 一个 30px 的装饰不值得
   在最常驻的页面上持续掉帧。 */
.search-glow {
  position: absolute;
  inset: -2px;
  border-radius: 9999px;
  background: linear-gradient(135deg, var(--color-primary), var(--color-accent), var(--color-primary-light));
  opacity: 0.55;
  z-index: 0;
}
.search-mini:hover .search-glow,
.search-mini:focus-visible .search-glow {
  opacity: 0.85;
  transition: opacity var(--transition-fast);
}

@keyframes glow-shift {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}

.search-icon {
  color: var(--color-primary);
  flex-shrink: 0;
}

.divider {
  width: 1px;
  height: 16px;
  background: var(--border-default);
  flex-shrink: 0;
}

.camera-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
  background: none;
  border: none;
  flex-shrink: 0;
}

.camera-btn:hover {
  color: var(--color-primary);
  background: var(--color-primary-glow);
}

.hidden-file-input {
  display: none;
}

.search-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: var(--el-mask-color);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  padding-top: 15vh;
}

.search-expanded-wrap {
  position: relative;
  width: 520px;
  max-width: 90vw;
  animation: morph-expand 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.search-expanded-glow {
  position: absolute;
  inset: -3px;
  border-radius: 32px;
  background: linear-gradient(135deg, var(--color-primary), var(--color-accent), var(--color-primary-light), var(--color-primary));
  background-size: 300% 300%;
  animation: glow-shift 3s ease infinite;
  opacity: 0.8;
  filter: blur(6px);
  z-index: 0;
}

.search-expanded {
  position: relative;
  z-index: 1;
  width: 100%;
  max-height: 60vh;
  display: flex;
  flex-direction: column;
  background: var(--glass-bg);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid var(--glass-border);
  border-radius: 28px;
  overflow: hidden;
}

@keyframes morph-expand {
  0% {
    position: fixed;
    left: var(--origin-left, 50%);
    top: var(--origin-top, 50%);
    width: var(--origin-width, 280px);
    height: var(--origin-height, 36px);
    border-radius: 9999px;
    opacity: 0.9;
  }
  40% {
    opacity: 1;
  }
  100% {
    position: fixed;
    left: 50%;
    top: 15vh;
    width: min(520px, 90vw);
    height: auto;
    transform: translateX(-50%);
  }
}

.overlay-leave-active .search-expanded-wrap {
  animation: morph-collapse 0.25s cubic-bezier(0.4, 0, 1, 1) forwards;
}

@keyframes morph-collapse {
  0% {
    position: fixed;
    left: 50%;
    top: 15vh;
    width: min(520px, 90vw);
    transform: translateX(-50%);
    opacity: 1;
  }
  100% {
    position: fixed;
    left: var(--origin-left, 50%);
    top: var(--origin-top, 50%);
    width: var(--origin-width, 280px);
    height: var(--origin-height, 36px);
    border-radius: 9999px;
    transform: scale(0.9);
    opacity: 0;
  }
}

.expanded-input {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 48px;
  padding: 0 16px;
  border-bottom: 1px solid var(--border-default);
  flex-shrink: 0;
}

.expanded-search-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: var(--font-md);
  color: var(--text-primary);
  min-width: 0;
}

.expanded-search-input::placeholder {
  color: var(--text-tertiary);
}

.expanded-input .search-icon {
  color: var(--color-primary);
  flex-shrink: 0;
}

.expanded-input .divider {
  flex-shrink: 0;
}

.expanded-input .camera-btn {
  flex-shrink: 0;
}

.expanded-input .camera-btn:hover {
  background: var(--color-primary-glow);
}

.clear-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px;
  border-radius: 50%;
  transition: color var(--transition-fast);
  background: none;
  border: none;
  flex-shrink: 0;
}

.clear-btn:hover {
  color: var(--text-primary);
}

.recognition-loading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md);
  border-bottom: 1px solid var(--border-default);
  font-size: var(--font-sm);
  color: var(--color-primary-light);
  flex-shrink: 0;
}

.image-section {
  padding: var(--spacing-sm) var(--spacing-md);
  border-bottom: 1px solid var(--border-default);
  flex-shrink: 0;
}

.image-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-xs);
}

.image-label {
  font-size: var(--font-sm);
  color: var(--color-primary-light);
  font-weight: 500;
}

.btn-text {
  font-size: var(--font-xs);
  color: var(--text-muted);
  cursor: pointer;
  background: none;
  border: none;
}

.btn-text:hover {
  color: var(--color-primary);
}

.recognized-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 200px;
  overflow-y: auto;
  margin-bottom: var(--spacing-sm);
}
.recognized-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: 4px 6px;
  font-size: var(--font-sm);
  border-radius: var(--radius-sm);
}
.recognized-item.is-existing {
  opacity: 0.5;
}
.recognized-item:hover {
  background: var(--bg-card-hover);
}

.picked-section {
  flex-shrink: 0;
  padding: 6px var(--spacing-md);
  border-top: 1px solid var(--border-subtle);
}

.picked-chips {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
  scrollbar-width: none;
}
.picked-chips::-webkit-scrollbar { display: none; }

.picked-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  flex-shrink: 0;
  max-width: 140px;
  padding: 3px 4px 3px 9px;
  border-radius: var(--radius-full);
  border: 1px solid var(--color-primary);
  background: var(--color-primary-glow);
  font-size: var(--font-xs);
  color: var(--color-primary-light);
}
.picked-chip.is-existing { opacity: 0.55; }

.picked-chip-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.picked-chip-x {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 15px;
  height: 15px;
  padding: 0;
  border: none;
  border-radius: var(--radius-full);
  background: transparent;
  color: currentColor;
  cursor: pointer;
  opacity: 0.65;
  transition: opacity var(--transition-fast), background-color var(--transition-fast);
}
.picked-chip-x:hover {
  opacity: 1;
  background: var(--color-fall);
  color: #fff;
}

.picked-clear {
  flex-shrink: 0;
  padding: 3px 8px;
  border: none;
  background: none;
  font-size: var(--font-xs);
  color: var(--text-muted);
  cursor: pointer;
}
.picked-clear:hover { color: var(--color-primary); }

.item-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  opacity: 0;
  transition: opacity var(--transition-fast), background-color var(--transition-fast),
              color var(--transition-fast);
}
.recognized-item:hover .item-remove { opacity: 1; }
.item-remove:hover {
  background: var(--color-fall);
  color: #fff;
}

@media (hover: none) {
  .item-remove { opacity: 1; }
}
.recognized-code {
  color: var(--text-muted);
  min-width: 60px;
}
.recognized-name {
  flex: 1;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.recognized-amount {
  color: var(--text-primary);
  min-width: 60px;
  text-align: right;
}
.recognized-profit {
  min-width: 60px;
  text-align: right;
}
.recognized-tag {
  font-size: var(--font-xs);
  color: var(--text-muted);
  background: var(--bg-elevated);
  padding: 1px 6px;
  border-radius: var(--radius-sm);
}

.progress-bar {
  position: relative;
  height: 20px;
  background: var(--color-primary-glow);
  border-radius: var(--radius-sm);
  overflow: hidden;
  margin-bottom: var(--spacing-sm);
}
.progress-fill {
  height: 100%;
  background: var(--color-primary);
  opacity: 0.4;
  transition: width 0.3s ease;
}
.progress-text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-xs);
  color: var(--color-primary-light);
}

.recognition-error {
  font-size: var(--font-xs);
  color: var(--color-rise);
  margin-bottom: var(--spacing-sm);
}

.text-profit { color: var(--color-rise); }
.text-loss { color: var(--color-fall); }

.btn-add-batch {
  width: 100%;
  padding: var(--spacing-xs);
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--font-sm);
  cursor: pointer;
  transition: opacity var(--transition-fast);
}

.btn-add-batch:hover {
  opacity: 0.9;
}

.result-list {
  overflow-y: auto;
  padding: var(--spacing-xs) 0;
  flex: 1;
  min-height: 0;
}

.result-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.result-item:hover {
  background: var(--bg-card-hover);
}

.result-item.is-picked {
  background: var(--color-primary-glow);
}

.result-check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 17px;
  height: 17px;
  flex-shrink: 0;
  border-radius: var(--radius-sm);
  border: 1.5px solid var(--border-default);
  color: var(--color-on-primary);
  transition: background-color var(--transition-fast), border-color var(--transition-fast);
}
.result-check.on {
  background: var(--color-primary);
  border-color: var(--color-primary);
}

.result-code {
  color: var(--text-muted);
  font-size: var(--font-sm);
  min-width: 60px;
}

.result-name {
  flex: 1;
  color: var(--text-primary);
  font-size: var(--font-sm);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-type {
  color: var(--text-tertiary);
  font-size: var(--font-xs);
  flex-shrink: 0;
}

.dropdown-empty {
  padding: var(--spacing-lg);
  text-align: center;
  color: var(--text-muted);
  font-size: var(--font-sm);
  flex-shrink: 0;
}

.overlay-enter-active {
  transition: opacity 0.3s ease;
}
.overlay-leave-active {
  transition: opacity 0.2s ease;
}
.overlay-enter-from,
.overlay-leave-to {
  opacity: 0;
}

@media (max-width: 767px) {

  .search-expanded-wrap {
    max-width: 92vw;
  }
}
</style>
