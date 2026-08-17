<template>
  <div class="gp-bar">
    <span class="gp-count">{{ countLabel }}</span>
    <div class="gp-chips">
      <button
        v-for="g in groupStore.sortedGroups"
        :key="g.id"
        type="button"
        class="gp-chip"
        :disabled="disabled"
        @click="$emit('pick', g.id)"
      >
        {{ g.name }}
      </button>
      <button type="button" class="gp-chip gp-chip-new" :disabled="disabled" @click="startCreate">
        ＋ 新建
      </button>
    </div>
    <div v-if="creating" class="gp-create">
      <input
        ref="inputRef"
        v-model="draftName"
        class="gp-input"
        placeholder="分组名称"
        maxlength="12"
        @keydown.enter="submitCreate"
        @keydown.escape="cancelCreate"
      />
      <button type="button" class="gp-mini" @click="submitCreate">创建并添加</button>
      <button type="button" class="gp-mini" @click="cancelCreate">取消</button>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { useGroupStore } from '@/modules/group/group-store'

const props = withDefaults(defineProps<{
  count: number
  disabled?: boolean
  noun?: string
}>(), {
  disabled: false,
  noun: '只',
})

const emit = defineEmits<{ pick: [groupId: string] }>()

const groupStore = useGroupStore()

const countLabel = computed(() => `已选 ${props.count} ${props.noun} · 添加到`)

const creating = ref(false)
const draftName = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

function startCreate(): void {
  creating.value = true
  draftName.value = ''
  void nextTick(() => inputRef.value?.focus())
}

function cancelCreate(): void {
  creating.value = false
  draftName.value = ''
}

function submitCreate(): void {
  const g = groupStore.createGroup(draftName.value)
  if (!g) { ElMessage.warning('请输入分组名称'); return }
  cancelCreate()
  emit('pick', g.id)
}
</script>
<style scoped>
.gp-bar {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md);
  background: var(--bg-card);
  border: 1px solid var(--border-default);
}

.gp-count {
  font-size: var(--font-xs);
  color: var(--text-muted);
}

.gp-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.gp-chip {
  padding: 5px 12px;
  border-radius: var(--radius-full);
  border: 1px solid var(--border-default);
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--font-xs);
  cursor: pointer;
  transition: background-color var(--transition-fast), color var(--transition-fast),
              border-color var(--transition-fast);
}
.gp-chip:hover:not(:disabled) {
  background: var(--color-primary-glow);
  border-color: var(--color-primary);
  color: var(--color-primary);
}
.gp-chip:disabled { opacity: 0.5; cursor: not-allowed; }
.gp-chip-new { color: var(--text-muted); border-style: dashed; }

.gp-create {
  display: flex;
  align-items: center;
  gap: 6px;
}

.gp-input {
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
.gp-input:focus { border-color: var(--color-primary); }

.gp-mini {
  padding: 4px 10px;
  border-radius: var(--radius-full);
  border: 1px solid var(--border-default);
  background: transparent;
  color: var(--text-muted);
  font-size: var(--font-xs);
  cursor: pointer;
  white-space: nowrap;
  transition: color var(--transition-fast), border-color var(--transition-fast);
}
.gp-mini:hover { color: var(--text-primary); border-color: var(--border-hover); }
</style>
