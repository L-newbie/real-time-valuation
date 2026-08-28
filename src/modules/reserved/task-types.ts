

export interface ScheduledTask {
  id: string

  fundCode: string

  fundName: string

  type: TaskType

  status: TaskStatus

  scheduledTime: string

  repeatMode: TaskRepeatMode

  createdAt: number

  executionCount: number

  lastExecutedAt: number | null

  note?: string
}

export enum TaskType {
  RefreshValuation = 'refresh_valuation',

  ClosingReminder = 'closing_reminder',

  NetValueUpdate = 'net_value_update',
}

export enum TaskStatus {
  Pending = 'pending',

  Running = 'running',

  Completed = 'completed',

  Cancelled = 'cancelled',

  Failed = 'failed',
}

export enum TaskRepeatMode {
  Once = 'once',

  Daily = 'daily',

  Workday = 'workday',
}
