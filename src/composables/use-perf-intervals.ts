

import { ref, watch, onUnmounted, type Ref } from 'vue'
import {
  peekPerfIntervals,
  fetchMissingPerf,
  type PerfIntervals,
} from '@/modules/fund/perf/perf-intervals'

export function usePerfIntervals(codes: Ref<string[]>) {
  const perfMap = ref<Map<string, PerfIntervals>>(new Map())

  let disposed = false

  function load(list: string[]): void {
    if (disposed || list.length === 0) return

    const merged = new Map(perfMap.value)
    for (const [code, perf] of peekPerfIntervals(list)) merged.set(code, perf)
    perfMap.value = merged

    void fetchMissingPerf(list, (updates) => {
      if (disposed) return

      const next = new Map(perfMap.value)
      for (const [code, perf] of updates) next.set(code, perf)
      perfMap.value = next
    }).catch(() => {  })
  }

  watch(
    () => [...(codes.value ?? [])].sort().join(','),
    () => load(codes.value ?? []),
    { immediate: true },
  )

  onUnmounted(() => { disposed = true })

  return { perfMap }
}
