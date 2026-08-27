

export const BUILTIN_GROUP_WATCH = 'watch'

export interface FundGroup {
  id: string

  name: string

  createdAt: number

  order: number

  builtin?: boolean
}

export interface GroupStats {
  groupId: string
  groupName: string
  fundCount: number
  totalHoldingAmount: number
  todayProfit: number
  totalProfit: number
  totalCost: number
  overallChangeRate: number
  todayReturnRate: number
}
