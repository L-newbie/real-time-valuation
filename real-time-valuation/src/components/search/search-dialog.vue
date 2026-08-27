<template>
  <el-dialog v-model="visible" title="添加基金" width="500px" :close-on-click-modal="false" class="search-dialog">
    <div class="search-container">
      <el-input v-model="searchKeyword" placeholder="输入基金代码或名称搜索" clearable size="large"
        @keyup.enter="handleDirectAdd">
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>
      <div v-if="isDirectCodeInput" class="direct-add-tip animate-fade-in">
        <el-icon><InfoFilled /></el-icon>
        输入的是基金代码，将直接添加 "{{ searchKeyword.trim() }}"
        <button class="btn-primary btn-sm ml-2" @click="handleDirectAdd">直接添加</button>
      </div>
      <div v-if="searchResults.length > 0 && !isDirectCodeInput" class="result-list animate-slide-down">
        <div v-for="item in searchResults" :key="item.fundCode" class="result-item" @click="handleSelect(item)">
          <span class="font-number result-code">{{ item.fundCode }}</span>
          <span class="result-name">{{ item.fundName }}</span>
          <span class="result-type">{{ item.fundType }}</span>
        </div>
      </div>
      <div v-if="searching && searchResults.length === 0 && !isDirectCodeInput" class="search-loading">
        <span class="animate-breathe">搜索中...</span>
      </div>
      <div class="upload-zone"
        :class="{ 'drag-over': isDragOver }"
        @click="triggerFileSelect"
        @dragover.prevent="isDragOver = true"
        @dragleave.prevent="isDragOver = false"
        @drop.prevent="handleDrop"
        @paste="handlePaste"
        tabindex="0">
        <div class="upload-icon-wrap">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        <div class="upload-label">识图导入</div>
        <div class="upload-hint">拖拽 / 粘贴 / 点击上传持仓截图</div>
      </div>
      <input ref="fileInput" type="file" accept="image/*" multiple class="hidden-file-input" @change="handleFileSelect" />
      <div v-if="isRecognizing && imageFunds.length === 0" class="recognition-loading animate-fade-in">
        <span class="animate-breathe">正在识别图片中...</span>
        <button class="btn-base btn-sm" @click="handleCancelRecognition">取消</button>
      </div>
      <div v-if="imageFunds.length > 0 || recognitionStatus === 'error'" class="result-section animate-fade-in">
        <div class="result-header">
          <span class="result-label">{{ imageFunds.length > 0 ? `识别到 ${imageFunds.length} 个基金` : '识别结果' }}</span>
          <button v-if="recognitionStatus !== 'recognizing'" class="btn-base btn-sm" @click="resetRecognition">清除</button>
          <button v-else class="btn-base btn-sm" @click="handleCancelRecognition">取消</button>
        </div>
        <div class="recognized-list">
          <div v-for="fund in imageFunds" :key="fund.fundCode" class="recognized-item" :class="{ 'is-existing': fundStore.fundCodes.includes(fund.fundCode) }">
            <span class="font-number recognized-code">{{ fund.fundCode }}</span>
            <span class="recognized-name">{{ fund.fundName }}</span>
            <span v-if="fund.holdingAmount != null" class="font-number recognized-amount">{{ fund.holdingAmount.toFixed(2) }}</span>
            <span v-if="fund.holdingProfit != null" class="font-number recognized-profit" :class="fund.holdingProfit > 0 ? 'text-profit' : fund.holdingProfit < 0 ? 'text-loss' : ''">{{ fund.holdingProfit > 0 ? '+' : '' }}{{ fund.holdingProfit.toFixed(2) }}</span>
            <span v-if="fundStore.fundCodes.includes(fund.fundCode)" class="recognized-tag">已关注</span>
          </div>
        </div>
        <div v-if="isRecognizing" class="progress-bar">
          <div class="progress-fill" :style="{ width: `${(progress.done / progress.total) * 100}%` }"></div>
          <span class="progress-text font-number">{{ progress.done }}/{{ progress.total }}</span>
        </div>
        <div v-if="recognitionError" class="recognition-error">{{ recognitionError }}</div>
        <GroupPickerBar
          v-if="imageFunds.length > 0"
          :count="imageFunds.length"
          @pick="handleImportRecognized"
        />
      </div>
    </div>
  </el-dialog>
</template>
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Search, InfoFilled } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

import { useFundSearch } from '@/composables/use-fund-search'
import { useFundStore } from '@/modules/fund/fund-store'
import { useGroupStore } from '@/modules/group/group-store'
import GroupPickerBar from '@/components/search/group-picker-bar.vue'
import type { SearchResult } from '@/modules/fund/fund-types'
import { isValidFundCode } from '@/shared/utils/validation'
import { useImageRecognition } from '@/composables/use-image-recognition'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [val: boolean] }>()

const fundStore = useFundStore()
const groupStore = useGroupStore()
const { keyword, results, searching, clearSearch, isDirectCode } = useFundSearch()

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

const searchKeyword = computed({
  get: () => keyword.value,
  set: (val) => { keyword.value = val },
})

const searchResults = computed(() => results.value)

const isDirectCodeInput = computed(() => isDirectCode(searchKeyword.value))

const isRecognizing = computed(() => recognitionStatus.value === 'reading' || recognitionStatus.value === 'recognizing')

const isDragOver = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
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

function handleDrop(e: DragEvent): void {
  isDragOver.value = false
  const files = e.dataTransfer?.files
  if (files && files.length > 0) {
    recognizeImages(Array.from(files))
  }
}

function handlePaste(e: ClipboardEvent): void {
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

async function handleImportRecognized(groupId: string): Promise<void> {
  const count = await importRecognized(groupId)
  if (count > 0) {
    ElMessage.success(`已添加 ${count} 个基金`)
    visible.value = false
    clearSearch()
    resetRecognition()
  } else {
    ElMessage.warning('没有新的基金可添加')
  }
}

function handleCancelRecognition(): void {
  cancelRecognition()
  resetRecognition()
}

function handleSelect(item: SearchResult): void {
  addToActiveGroup(item.fundCode, item.fundName)
  visible.value = false
  clearSearch()
}

function addToActiveGroup(code: string, name?: string): void {
  const gid = groupStore.activeGroupId
  const before = groupStore.getMembers(gid).length
  fundStore.addFund(code, name, gid)
  const groupName = groupStore.activeGroup?.name ?? '分组'
  if (groupStore.getMembers(gid).length > before) {
    ElMessage.success(`已添加${name ? ` ${name}` : ''}到「${groupName}」`)
    void fundStore.fetchValuation(code)
  } else {
    ElMessage.warning(`${code} 已在「${groupName}」中`)
  }
}

function handleDirectAdd(): void {
  const code = searchKeyword.value.trim()
  if (!isValidFundCode(code)) {
    ElMessage.error('基金代码格式不正确，请输入6位数字')
    return
  }
  addToActiveGroup(code)
  visible.value = false
  clearSearch()
}

watch(visible, (val) => {
  if (!val) {
    clearSearch()
    resetRecognition()
  }
})
</script>
<style scoped>
.search-container {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  min-height: 0;
  flex: 1;
}

.direct-add-tip {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-primary-glow);
  border-radius: var(--radius-md);
  font-size: var(--font-sm);
  color: var(--color-primary-light);
}

.result-list {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
}

.result-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-sm) var(--spacing-md);
  cursor: pointer;
  transition: background var(--transition-fast);
}
.result-item:hover {
  background: var(--bg-card-hover);
}

.result-code {
  color: var(--text-muted);
  font-size: var(--font-sm);
}
.result-name {
  flex: 1;
  color: var(--text-primary);
  font-size: var(--font-sm);
}
.result-type {
  color: var(--text-muted);
  font-size: var(--font-xs);
}

.search-loading {
  text-align: center;
  padding: var(--spacing-lg);
  color: var(--text-muted);
}

.upload-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-lg) var(--spacing-md);
  border: 1px dashed var(--color-primary-glow);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--transition-fast);
  background: var(--bg-surface);
  outline: none;
  flex: 1;
  min-height: 120px;
}
.upload-zone:hover,
.upload-zone:focus {
  border-color: var(--color-primary);
  background: var(--color-primary-glow);
}
.upload-zone.drag-over {
  border-color: var(--color-primary);
  background: var(--color-primary-glow);
}
.upload-icon-wrap {
  color: var(--color-primary);
  opacity: 0.5;
  transition: opacity var(--transition-fast);
}
.upload-zone:hover .upload-icon-wrap,
.upload-zone:focus .upload-icon-wrap {
  opacity: 0.8;
}
.upload-label {
  font-size: var(--font-xs);
  color: var(--text-muted);
  letter-spacing: 0.5px;
}
.upload-hint {
  font-size: 11px;
  color: var(--text-muted);
  opacity: 0.7;
  margin-top: 2px;
}

.recognition-loading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md);
  background: var(--color-primary-glow);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-primary-glow);
  font-size: var(--font-sm);
  color: var(--color-primary-light);
}

.result-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-primary-glow);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-primary-glow);
}
.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.result-label {
  font-size: var(--font-sm);
  color: var(--color-primary-light);
  font-weight: 500;
}

.recognized-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 200px;
  overflow-y: auto;
}
.recognized-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: 4px var(--spacing-xs);
  font-size: var(--font-sm);
  border-radius: var(--radius-sm);
}
.recognized-item.is-existing {
  opacity: 0.5;
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
  margin: var(--spacing-xs) 0;
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
  padding: var(--spacing-xs) 0;
}

.text-profit { color: var(--color-rise); }
.text-loss { color: var(--color-fall); }
.import-actions {
  display: flex;
  justify-content: flex-end;
}

.hidden-file-input {
  display: none;
}
</style>
