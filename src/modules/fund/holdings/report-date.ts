

export function detectReportType(reportDate: string): { reportType: string; isFull: boolean } {
  if (!reportDate) return { reportType: '未知', isFull: false }
  const month = reportDate.substring(5, 7)
  switch (month) {
    case '03': return { reportType: '一季报', isFull: false }
    case '06': return { reportType: '半年报', isFull: true }
    case '09': return { reportType: '三季报', isFull: false }
    case '12': return { reportType: '年报', isFull: true }
    default: return { reportType: '未知', isFull: false }
  }
}

export function extractAvailableYears(apidata: any): string[] {
  if (!apidata) return []
  const yearStr = apidata.year
  if (!yearStr) return []
  if (Array.isArray(yearStr)) return yearStr.map(String)
  if (typeof yearStr === 'string') return yearStr.split(/\s+/).filter(Boolean)
  return []
}
