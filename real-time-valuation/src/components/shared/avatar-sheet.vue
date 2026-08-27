<template>
  <BottomSheet :visible="visible" title="更换头像" center @update:visible="$emit('update:visible', $event)">
    <div class="av">
      <button class="av-preview" :style="previewStyle" @click="pickFile">
        <img v-if="draft" :src="draft" alt="头像预览" class="av-img" />
        <span v-else class="av-initial">{{ initial }}</span>
        <span class="av-mask">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
          </svg>
        </span>
      </button>
      <button class="av-pick" @click="pickFile">选择图片</button>
      <p class="av-hint">建议使用方形图片，大小不超过 512KB</p>
      <input ref="fileEl" type="file" accept="image/*" class="av-file" @change="onFile" />
      <div class="av-acts">
        <button v-if="draft" class="av-ghost" @click="draft = ''">移除头像</button>
        <button class="av-primary" @click="save">保存</button>
      </div>
    </div>
  </BottomSheet>
</template>
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import BottomSheet from '@/components/shared/bottom-sheet.vue'
import { STORAGE_KEYS } from '@/config/constants'
import { loadString, saveString } from '@/shared/cache/local-storage-io'

const props = defineProps<{
  visible: boolean
  color: string
  initial: string
}>()

const emit = defineEmits<{
  'update:visible': [v: boolean]
  updated: []
}>()

const fileEl = ref<HTMLInputElement | null>(null)

const draft = ref('')

watch(() => props.visible, (v) => {
  if (v) draft.value = loadString(STORAGE_KEYS.USER_AVATAR) || ''
})

const previewStyle = computed(() => (draft.value ? {} : { background: props.color }))

function pickFile(): void { fileEl.value?.click() }

const MAX_BYTES = 512 * 1024

function onFile(e: Event): void {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  if (!f) return
  if (!f.type.startsWith('image/')) {
    ElMessage.warning('请选择图片文件')
    input.value = ''
    return
  }
  if (f.size > MAX_BYTES) {
    ElMessage.warning('图片请控制在 512KB 以内')
    input.value = ''
    return
  }
  const reader = new FileReader()
  reader.onload = () => { draft.value = String(reader.result || ''); input.value = '' }
  reader.onerror = () => { ElMessage.error('图片读取失败'); input.value = '' }
  reader.readAsDataURL(f)
}

function save(): void {
  try {
    saveString(STORAGE_KEYS.USER_AVATAR, draft.value)
    emit('updated')
    ElMessage.success(draft.value ? '头像已更新' : '已恢复默认头像')
    emit('update:visible', false)
  } catch {
    ElMessage.error('保存失败，请换一张更小的图片')
  }
}
</script>
<style scoped>
.av { display: flex; flex-direction: column; align-items: center; gap: var(--spacing-md); }

.av-preview {
  position: relative;
  width: 104px;
  height: 104px;
  border-radius: var(--radius-full);
  border: none;
  padding: 0;
  overflow: hidden;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.av-img { width: 100%; height: 100%; object-fit: cover; }
.av-initial { font-size: var(--font-3xl); font-weight: 700; color: #fff; }
.av-mask {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.38);
  color: #fff;
  opacity: 0;
  transition: opacity var(--transition-fast);
}
.av-preview:hover .av-mask { opacity: 1; }

.av-pick {
  padding: 8px 20px;
  border-radius: var(--radius-full);
  border: 1px solid var(--color-primary);
  background: var(--color-primary-glow);
  color: var(--color-primary);
  font-size: var(--font-sm);
  font-weight: 600;
  cursor: pointer;
  transition: background-color var(--transition-fast), color var(--transition-fast);
}
.av-pick:hover { background: var(--color-primary); color: var(--color-on-primary); }

.av-hint {
  margin: 0;
  font-size: var(--font-xs);
  color: var(--text-muted);
  text-align: center;
  line-height: 1.5;
}
.av-file { display: none; }

.av-acts { display: flex; gap: var(--spacing-sm); width: 100%; }
.av-ghost,
.av-primary {
  flex: 1;
  padding: 11px var(--spacing-md);
  border-radius: var(--radius-md);
  font-size: var(--font-sm);
  font-weight: 600;
  cursor: pointer;
  transition: background-color var(--transition-fast), border-color var(--transition-fast),
              color var(--transition-fast);
}
.av-ghost {
  border: 1px solid var(--border-default);
  background: transparent;
  color: var(--text-secondary);
}
.av-ghost:hover { border-color: var(--color-rise); color: var(--color-rise); }
.av-primary {
  border: none;
  background: var(--color-primary);
  color: var(--color-on-primary);
}
.av-primary:hover { background: var(--color-primary-light); }
</style>
