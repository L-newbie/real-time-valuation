

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ScheduledTask } from '@/modules/reserved/task-types'
import { TaskType, TaskStatus, TaskRepeatMode } from '@/modules/reserved/task-types'
import { createTask, updateTaskStatus, markTaskExecuted, cancelTask, removeFinishedTasks, getActiveTasks, loadTasks, saveTasks, TaskScheduler } from '@/shared/utils/task-manager'

export const useTaskStore = defineStore('task', () => {
  const tasks = ref<ScheduledTask[]>([])

  const scheduler = ref<TaskScheduler | null>(null)

  const activeTasks = computed(() => getActiveTasks(tasks.value))

  const pendingCount = computed(() => tasks.value.filter(t => t.status === TaskStatus.Pending).length)

  const completedCount = computed(() => tasks.value.filter(t => t.status === TaskStatus.Completed).length)

  function getTasksByFund(fundCode: string): ScheduledTask[] {
    return tasks.value.filter(t => t.fundCode === fundCode)
  }

  function addTask(
    fundCode: string,
    fundName: string,
    type: TaskType,
    scheduledTime: string,
    repeatMode: TaskRepeatMode = TaskRepeatMode.Once,
    note?: string,
  ): ScheduledTask {
    const task = createTask(fundCode, fundName, type, scheduledTime, repeatMode, note)
    tasks.value.push(task)
    persistTasks()
    return task
  }

  function updateStatus(taskId: string, status: TaskStatus): void {
    tasks.value = updateTaskStatus(tasks.value, taskId, status)
    persistTasks()
  }

  function markExecuted(taskId: string): void {
    tasks.value = markTaskExecuted(tasks.value, taskId)
    persistTasks()
  }

  function cancelTaskById(taskId: string): void {
    tasks.value = cancelTask(tasks.value, taskId)
    persistTasks()
  }

  function clearFinishedTasks(): void {
    tasks.value = removeFinishedTasks(tasks.value)
    persistTasks()
  }

  function startScheduler(onExecute: (task: ScheduledTask) => void): void {
    if (scheduler.value) return
    scheduler.value = new TaskScheduler(onExecute)
    scheduler.value.start()
  }

  function stopScheduler(): void {
    if (scheduler.value) {
      scheduler.value.stop()
      scheduler.value = null
    }
  }

  function isSchedulerRunning(): boolean {
    return scheduler.value?.isRunning() ?? false
  }

  function restoreTasks(): void {
    tasks.value = loadTasks()
  }

  function persistTasks(): void {
    saveTasks(tasks.value)
  }

  return {
    tasks,
    activeTasks,
    pendingCount,
    completedCount,
    getTasksByFund,
    addTask,
    updateStatus,
    markExecuted,
    cancelTaskById,
    clearFinishedTasks,
    startScheduler,
    stopScheduler,
    isSchedulerRunning,
    restoreTasks,
  }
})
