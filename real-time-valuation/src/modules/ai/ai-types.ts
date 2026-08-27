

export type RecognitionStatus = 'idle' | 'reading' | 'recognizing' | 'done' | 'error'

export interface RecognizedFund {
  fundCode: string

  fundName: string

  holdingAmount?: number

  holdingProfit?: number
}
