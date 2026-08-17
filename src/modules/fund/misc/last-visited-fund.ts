const state = { code: '' }

export function markLastVisitedFund(code: string): void {
  state.code = code
}

export function takeLastVisitedFund(): string {
  const code = state.code
  state.code = ''
  return code
}
