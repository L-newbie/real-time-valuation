<template>
  <BottomSheet :visible="visible" title="修改昵称" center @update:visible="$emit('update:visible', $event)">
    <div class="nm">
      <div class="nm-field">
        <div class="nm-input-wrap">
          <input
            ref="inputEl"
            v-model="draft"
            type="text"
            class="nm-input"
            maxlength="16"
            placeholder="给自己起个名字"
            @keydown.enter="save"
          />
          <span class="nm-count">{{ draft.length }}/16</span>
        </div>
        <p v-if="error" class="nm-err">{{ error }}</p>
        <p v-else class="nm-hint">最多 16 个字符，仅保存在本机</p>
      </div>
      <button class="nm-primary" @click="save">保存</button>
    </div>
  </BottomSheet>
</template>
<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import BottomSheet from '@/components/shared/bottom-sheet.vue'
import { STORAGE_KEYS } from '@/config/constants'
import { loadJSON, saveJSON } from '@/shared/cache/local-storage-io'

const props = defineProps<{
  visible: boolean
  nickname: string
}>()

const emit = defineEmits<{
  'update:visible': [v: boolean]
  updated: []
}>()

const inputEl = ref<HTMLInputElement | null>(null)
const draft = ref(props.nickname)
const error = ref('')

watch(() => props.visible, (v) => {
  if (v) {
    draft.value = props.nickname
    error.value = ''
    void nextTick(() => inputEl.value?.focus())
  }
})

function save(): void {
  const v = draft.value.trim()
  if (v.length === 0) {
    error.value = '昵称不能为空'
    return
  }
  error.value = ''

  const cur = loadJSON<Record<string, unknown> | null>(STORAGE_KEYS.RANDOM_NICKNAME, null) || {}
  saveJSON(STORAGE_KEYS.RANDOM_NICKNAME, { ...cur, nickname: v, initial: v.charAt(0) })
  emit('updated')
  ElMessage.success('已保存')
  emit('update:visible', false)
}
</script>
<style scoped>
.nm { display: flex; flex-direction: column; gap: var(--spacing-lg); }

.nm-field { display: flex; flex-direction: column; gap: 6px; }
.nm-input-wrap {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: 0 var(--spacing-md);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
  background: var(--bg-input);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}
.nm-input-wrap:focus-within {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-glow);
}
.nm-input {
  flex: 1;
  min-width: 0;
  padding: 12px 0;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: var(--font-lg);
  outline: none;
}
.nm-count { font-size: 10px; color: var(--text-muted); font-variant-numeric: tabular-nums; flex-shrink: 0; }
.nm-err { margin: 0; font-size: var(--font-xs); color: var(--color-rise); }
.nm-hint { margin: 0; font-size: var(--font-xs); color: var(--text-muted); }

.nm-primary {
  padding: 12px var(--spacing-md);
  border-radius: var(--radius-md);
  border: none;
  background: var(--color-primary);
  color: var(--color-on-primary);
  font-size: var(--font-sm);
  font-weight: 600;
  cursor: pointer;
  transition: background-color var(--transition-fast);
}
.nm-primary:hover { background: var(--color-primary-light); }
</style>
