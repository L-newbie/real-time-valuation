

export enum HoldingActionType {
  Add = 'add',

  Reduce = 'reduce',

  Edit = 'edit',

  Settle = 'settle',
}

export interface HoldingAction {
  id: string

  fundCode: string

  groupId?: string

  type: HoldingActionType

  sharesBefore: number

  sharesAfter: number

  costBefore: number

  costAfter: number

  timestamp: number

  markDate?: string

  note?: string
}

export enum PendingActionStatus {
  Pending = 'pending',

  Executed = 'executed',

  Cancelled = 'cancelled',

  Failed = 'failed',
}

export interface PendingAction {
  id: string

  fundCode: string

  groupId?: string

  type: 'add' | 'reduce'

  amount: number

  referenceNav: number

  scheduledDate: string

  operateTime: number

  status: PendingActionStatus

  executedNav?: number

  executedNavDate?: string

  executedAt?: number

  failedReason?: string

  attemptCount?: number

  lastAttemptDate?: string

  note?: string

  createdAt: number
}

export interface DashboardStats {
  totalHoldingAmount: number

  todayProfit: number

  totalProfit: number

  overallChangeRate: number

  totalCost: number

  todayReturnRate: number
}
