

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

  note?: string

  createdAt: number
}

export interface StatsValuation {
  gz: number
  dwjz: number
  gszzl: number
  isEstimated?: boolean
  jzrq?: string
  delayDays?: 1 | 2
  realtimeGszzl?: number
  realtimeSource?: string
  realtimeUpdatedAt?: string
}

export interface DashboardStats {
  totalHoldingAmount: number

  todayProfit: number

  totalProfit: number

  overallChangeRate: number

  totalCost: number

  todayReturnRate: number

  predictedProfit: number | null

  predictedReturnRate: number | null

  predictedFundCount: number
}
