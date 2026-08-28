<template>
  <el-dialog v-model="visible" title="任务管理" width="600px">
    <div class="task-container">
      <div class="task-stats">
        <div class="stat-item">
          <span class="stat-label">待执行</span>
          <span class="stat-value font-number text-primary">{{ pendingCount }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">已完成</span>
          <span class="stat-value font-number text-fall">{{ completedCount }}</span>
        </div>
      </div>
      <div v-if="tasks.length > 0" class="task-list animate-stagger-auto">
        <div v-for="task in tasks" :key="task.id" class="glass-card task-item">
          <div class="task-header">
            <span class="font-number task-code">{{ task.fundCode }}</span>
            <span class="task-name">{{ task.fundName }}</span>
            <span :class="['task-status', `status-${task.status}`]">{{ statusLabel(task.status) }}</span>
          </div>
          <div class="task-body">
            <span class="task-info">类型: {{ typeLabel(task.type) }}</span>
            <span class="task-info">计划: {{ task.scheduledTime }}</span>
            <span class="task-info">重复: {{ repeatLabel(task.repeatMode) }}</span>
          </div>
          <div class="task-actions">
            <button v-if="task.status === 'pending'" class="btn-base btn-sm" @click="cancelTask(task.id)">取消</button>
            <button v-if="task.status === 'completed' || task.status === 'cancelled'" class="btn-base btn-sm btn-danger" @click="deleteTask(task.id)">删除</button>
          </div>
        </div>
      </div>
      <div v-else class="empty-state">
        <p class="text-muted">暂无任务</p>
      </div>
    </div>
  </el-dialog>
</template>
<script setup lang="ts">

import { computed } from 'vue'
import { useTaskStore } from '@/modules/reserved/task-store'
import { TaskStatus, TaskType, TaskRepeatMode } from '@/modules/reserved/task-types'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [val: boolean] }>()

const taskStore = useTaskStore()

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

const tasks = computed(() => taskStore.tasks)
const pendingCount = computed(() => taskStore.pendingCount)
const completedCount = computed(() => taskStore.completedCount)

function statusLabel(status: TaskStatus): string {
  const map: Record<string, string> = {
    [TaskStatus.Pending]: '待执行',
    [TaskStatus.Running]: '执行中',
    [TaskStatus.Completed]: '已完成',
    [TaskStatus.Cancelled]: '已取消',
    [TaskStatus.Failed]: '失败',
  }
  return map[status] ?? status
}

function typeLabel(type: TaskType): string {
  const map: Record<string, string> = {
    [TaskType.RefreshValuation]: '估值刷新',
    [TaskType.ClosingReminder]: '收盘提醒',
    [TaskType.NetValueUpdate]: '净值更新',
  }
  return map[type] ?? type
}

function repeatLabel(mode: TaskRepeatMode): string {
  const map: Record<string, string> = {
    [TaskRepeatMode.Once]: '仅一次',
    [TaskRepeatMode.Daily]: '每日',
    [TaskRepeatMode.Workday]: '工作日',
  }
  return map[mode] ?? mode
}

function cancelTask(id: string): void {
  taskStore.cancelTaskById(id)
}

function deleteTask(id: string): void {
  taskStore.cancelTaskById(id)
  taskStore.clearFinishedTasks()
}
</script>
<style scoped>
.task-container {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.task-stats {
  display: flex;
  gap: var(--spacing-lg);
}
.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-xs);
}
.stat-label {
  font-size: var(--font-xs);
  color: var(--text-muted);
}
.stat-value {
  font-size: var(--font-xl);
  font-weight: 700;
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}
.task-item {
  padding: var(--spacing-md);
}
.task-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-sm);
}
.task-code {
  font-size: var(--font-sm);
  color: var(--text-muted);
}
.task-name {
  flex: 1;
  color: var(--text-primary);
  font-size: var(--font-sm);
}
.task-status {
  font-size: var(--font-xs);
  padding: 2px 8px;
  border-radius: var(--radius-sm);
}
.status-pending { background: var(--color-primary-glow); color: var(--color-primary-light); }
.status-running { background: rgba(234,179,8,0.15); color: var(--color-warning, #eab308); }
.status-completed { background: var(--color-fall-glow); color: var(--color-fall); }
.status-cancelled { background: var(--bg-elevated); color: var(--text-muted); }
.status-failed { background: var(--color-rise-glow); color: var(--color-rise); }

.task-body {
  display: flex;
  gap: var(--spacing-md);
  font-size: var(--font-xs);
  color: var(--text-muted);
}
.task-info {
  white-space: nowrap;
}

.task-actions {
  display: flex;
  gap: var(--spacing-xs);
  margin-top: var(--spacing-sm);
  justify-content: flex-end;
}

.empty-state {
  text-align: center;
  padding: var(--spacing-2xl);
}

.btn-danger {
  color: var(--color-rise);
  border-color: var(--color-rise-glow);
}
</style>
