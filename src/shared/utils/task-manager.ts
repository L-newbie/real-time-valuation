

import type { ScheduledTask } from '@/modules/reserved/task-types'
import { TaskType, TaskStatus, TaskRepeatMode } from '@/modules/reserved/task-types'
import { STORAGE_KEYS } from '@/config/constants'
import { generateId } from '@/shared/utils/validation'
import { loadJSON, saveJSON } from '@/shared/cache/local-storage-io'

export function loadTasks(): ScheduledTask[] {
  const tasks = loadJSON<ScheduledTask[]>(STORAGE_KEYS.TASKS, [])
  return Array.isArray(tasks) ? tasks.filter(t => t.fundCode && t.id) : []
}

export function saveTasks(tasks: ScheduledTask[]): void {
  saveJSON(STORAGE_KEYS.TASKS, tasks)
}

export function createTask(
  fundCode: string,
  fundName: string,
  type: TaskType,
  scheduledTime: string,
  repeatMode: TaskRepeatMode = TaskRepeatMode.Once,
  note?: string,
): ScheduledTask {
  return {
    id: generateId(),
    fundCode,
    fundName,
    type,
    status: TaskStatus.Pending,
    scheduledTime,
    repeatMode,
    createdAt: Date.now(),
    executionCount: 0,
    lastExecutedAt: null,
    note,
  }
}

export function updateTaskStatus(tasks: ScheduledTask[], taskId: string, status: TaskStatus): ScheduledTask[] {
  return tasks.map(t => t.id === taskId ? { ...t, status } : t)
}

export function markTaskExecuted(tasks: ScheduledTask[], taskId: string): ScheduledTask[] {
  return tasks.map(t => {
    if (t.id !== taskId) return t
    const newCount = t.executionCount + 1

    const newStatus = t.repeatMode === TaskRepeatMode.Once ? TaskStatus.Completed : TaskStatus.Pending
    return {
      ...t,
      executionCount: newCount,
      lastExecutedAt: Date.now(),
      status: newStatus,
    }
  })
}

export function cancelTask(tasks: ScheduledTask[], taskId: string): ScheduledTask[] {
  return updateTaskStatus(tasks, taskId, TaskStatus.Cancelled)
}

export function removeFinishedTasks(tasks: ScheduledTask[]): ScheduledTask[] {
  return tasks.filter(t => t.status !== TaskStatus.Completed && t.status !== TaskStatus.Cancelled)
}

export function getActiveTasks(tasks: ScheduledTask[]): ScheduledTask[] {
  return tasks.filter(t => t.status === TaskStatus.Pending || t.status === TaskStatus.Running)
}

export class TaskScheduler {
  private timerId: number | null = null
  private onExecute: (task: ScheduledTask) => void
  private intervalMs: number

  constructor(onExecute: (task: ScheduledTask) => void, intervalMs: number = 60000) {
    this.onExecute = onExecute
    this.intervalMs = intervalMs
  }

  start(): void {
    if (this.timerId) return
    this.timerId = window.setInterval(() => {
      this.checkAndExecute()
    }, this.intervalMs)
  }

  stop(): void {
    if (this.timerId) {
      clearInterval(this.timerId)
      this.timerId = null
    }
  }

  private checkAndExecute(): void {
    const tasks = loadTasks()
    const now = new Date()
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`

    const activeTasks = getActiveTasks(tasks)
    for (const task of activeTasks) {
      if (task.scheduledTime === currentTime) {
        this.onExecute(task)
      }
    }
  }

  isRunning(): boolean {
    return this.timerId !== null
  }
}
