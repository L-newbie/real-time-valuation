import { ref } from 'vue'

export type StockQuoteMode = 'close' | 'realtime'

export const stockQuoteMode = ref<StockQuoteMode>('close')

export type CardRangeKey = 'w' | 'm1' | 'm3' | 'm6' | 'y1'

export const cardNavRange = ref<CardRangeKey>('y1')

export type DetailRangeKey = 'today' | 'm1' | 'm3' | 'm6' | 'y1' | 'all'

export const detailChartRange = ref<DetailRangeKey>('today')

export type DetailTabKey = 'stocks' | 'perf' | 'alloc' | 'risk' | 'info' | 'holder'

export const detailTab = ref<DetailTabKey>('stocks')

export const detailScrollTop = ref(0)

export type CardTabKey = 'holding' | 'nav' | 'perf' | 'stocks'

export const cardTab = ref<CardTabKey>('holding')
