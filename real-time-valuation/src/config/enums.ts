

export enum ChangeDirection {
  Rise = 'rise',

  Fall = 'fall',

  Flat = 'flat',
}

export enum RefreshStatus {
  Idle = 'idle',

  Loading = 'loading',

  Success = 'success',

  Failed = 'failed',
}

export enum ValuationValidity {
  Valid = 'valid',

  CrossDay = 'cross_day',

  Weekend = 'weekend',

  Holiday = 'holiday',
}

export enum ProfitStatus {
  Profit = 'profit',

  Loss = 'loss',

  BreakEven = 'break_even',
}
