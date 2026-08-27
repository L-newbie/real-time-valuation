

import { ref } from 'vue'
import { useFundStore } from '@/modules/fund/fund-store'
import { useHoldingStore } from '@/modules/holding/holding-store'
import { useGroupStore } from '@/modules/group/group-store'
import { BUILTIN_GROUP_WATCH } from '@/modules/group/group-types'
import { recognizeFundFromImage } from '@/modules/ai/glm-vision'
import { matchFundByCatalogName } from '@/modules/fund/catalog/fund-name-match'
import { isValidFundCode } from '@/shared/utils/validation'
import { safeDivide } from '@/shared/utils/safe-math'
import { peekNavSeries, fetchMissingPerf } from '@/modules/fund/perf/perf-intervals'
import { findDateByNav } from '@/modules/holding/trade-marks'
import type { RecognizedFund, RecognitionStatus } from '@/modules/ai/ai-types'

const MAX_CONCURRENT = 3

const GLM_MAX_ATTEMPTS = 3

const GLM_RETRY_BACKOFF = 600
const FILE_READER_TIMEOUT = 10000
const IMAGE_MAX_SIZE = 1024
const IMAGE_QUALITY = 0.8

export function useImageRecognition() {
  const fundStore = useFundStore()
  const holdingStore = useHoldingStore()

  const recognizedFunds = ref<RecognizedFund[]>([])
  const status = ref<RecognitionStatus>('idle')
  const progress = ref({ done: 0, total: 0 })
  const errorMessage = ref('')

  const abortControllers = ref<AbortController[]>([])

  function readFileAsBase64(file: File, signal?: AbortSignal): Promise<string> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new DOMException('Aborted', 'AbortError'))
        return
      }

      const img = new Image()
      const url = URL.createObjectURL(file)

      const timer = setTimeout(() => {
        URL.revokeObjectURL(url)
        reject(new Error('文件读取超时'))
      }, FILE_READER_TIMEOUT)

      img.onload = () => {
        URL.revokeObjectURL(url)
        clearTimeout(timer)

        try {
          let { width, height } = img
          if (Math.max(width, height) > IMAGE_MAX_SIZE) {
            const ratio = IMAGE_MAX_SIZE / Math.max(width, height)
            width = Math.round(width * ratio)
            height = Math.round(height * ratio)
          }

          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')!
          ctx.drawImage(img, 0, 0, width, height)

          const dataUrl = canvas.toDataURL('image/jpeg', IMAGE_QUALITY)
          resolve(dataUrl)
        } catch (e) {
          reject(new Error('图片处理失败'))
        }
      }

      img.onerror = () => {
        URL.revokeObjectURL(url)
        clearTimeout(timer)
        reject(new Error('图片加载失败'))
      }

      if (signal) {
        signal.addEventListener('abort', () => {
          URL.revokeObjectURL(url)
          clearTimeout(timer)
          reject(new DOMException('Aborted', 'AbortError'))
        }, { once: true })
      }

      img.src = url
    })
  }

  async function recognizeImages(files: File[]): Promise<void> {
    if (files.length === 0) return

    status.value = 'reading'
    progress.value = { done: 0, total: files.length }
    errorMessage.value = ''
    recognizedFunds.value = []

    abortControllers.value = files.map(() => new AbortController())

    const allFunds: RecognizedFund[] = []
    let firstError: string | null = null
    let queueIndex = 0

    async function processNext(): Promise<void> {
      while (queueIndex < files.length) {
        const i = queueIndex++
        const file = files[i]
        const controller = abortControllers.value[i]

        try {
          status.value = 'recognizing'
          const base64 = await readFileAsBase64(file, controller.signal)

          let funds: RecognizedFund[] = []
          let lastErr: unknown = null
          for (let attempt = 1; attempt <= GLM_MAX_ATTEMPTS; attempt++) {
            if (controller.signal.aborted) break
            try {
              funds = await recognizeFundFromImage(base64, controller.signal)
              break
            } catch (e) {
              lastErr = e

              if (e instanceof DOMException && e.name === 'AbortError') break

              if (attempt < GLM_MAX_ATTEMPTS) {
                await new Promise(resolve => setTimeout(resolve, attempt * GLM_RETRY_BACKOFF))
              }
            }
          }
          if (controller.signal.aborted) return
          if (funds.length === 0 && lastErr) {
            const msg = lastErr instanceof Error ? lastErr.message : String(lastErr)
            if (!firstError) firstError = msg
          }
          allFunds.push(...funds)
        } catch (e) {
          if (e instanceof DOMException && e.name === 'AbortError') return

          const msg = e instanceof Error ? e.message : String(e)
          if (!firstError) firstError = msg
        } finally {
          progress.value.done++
        }
      }
    }

    const workers = Array.from(
      { length: Math.min(MAX_CONCURRENT, files.length) },
      () => processNext(),
    )

    await Promise.allSettled(workers)

    for (const fund of allFunds) {
      if (!fund.fundName) continue
      try {
        const m = await matchFundByCatalogName(fund.fundName)
        if (m) {
          console.log('[补码]', fund.fundName, '→', m.fundCode, m.matchedName, `(${m.method} ${(m.score * 100).toFixed(0)}%)`)
          fund.fundCode = m.fundCode

          fund.fundName = m.matchedName
        } else {
          fund.fundCode = ''
        }
      } catch {
      }
    }

    const seen = new Map<string, RecognizedFund>()
    for (const f of allFunds) {
      const existing = seen.get(f.fundCode)
      if (!existing) {
        seen.set(f.fundCode, f)
      } else {
        if (existing.fundName && f.fundName && existing.fundName !== f.fundName) {
          console.warn('[去重撞车] 同一 fundCode', f.fundCode, '但 fundName 不同：', existing.fundName, 'vs', f.fundName,
            '→ 金额', existing.holdingAmount, '/', f.holdingAmount)
        }

        seen.set(f.fundCode, {
          ...existing,
          holdingAmount: existing.holdingAmount ?? f.holdingAmount,
          holdingProfit: existing.holdingProfit ?? f.holdingProfit,
          fundName: existing.fundName || f.fundName,
        })
      }
    }

    const results = Array.from(seen.values())

    recognizedFunds.value = results.filter(f => isValidFundCode(f.fundCode))

    if (recognizedFunds.value.length === 0 && files.length > 0) {
      errorMessage.value = firstError || '未识别到有效的基金信息'
      status.value = 'error'
    } else {
      status.value = 'done'
    }
  }

  function cancelRecognition(): void {
    for (const c of abortControllers.value) {
      c.abort()
    }
    abortControllers.value = []
    status.value = 'idle'
  }

  async function importRecognized(groupId: string): Promise<number> {
    const groupStore = useGroupStore()
    const targetGroup = groupId || groupStore.activeGroupId

    let imported = 0
    for (const fund of recognizedFunds.value) {
      const isNew = !fundStore.fundCodes.includes(fund.fundCode)
      fundStore.addFund(fund.fundCode, fund.fundName, targetGroup)

      if (isNew) {
        await fundStore.fetchValuation(fund.fundCode)
      }

      const hasHolding = fund.holdingAmount != null && fund.holdingProfit != null
      if (hasHolding) {
        const recognizedAmount = fund.holdingAmount ?? 0
        const recognizedProfit = fund.holdingProfit ?? 0
        const costBasis = recognizedAmount - recognizedProfit

        if (holdingStore.holdings.some(h => h.fundCode === fund.fundCode && !h.settled && (h.groupId ?? BUILTIN_GROUP_WATCH) === targetGroup)) {
          holdingStore.removeHoldingsByFund(fund.fundCode, targetGroup)
        }

        const v = fundStore.getValuation(fund.fundCode)
        const nav = (v?.dwjz ?? 0) > 0 ? v!.dwjz : ((v?.gz ?? 0) > 0 ? v!.gz : 0)

        const shares = nav > 0 && recognizedAmount > 0
          ? safeDivide(recognizedAmount, nav)
          : (recognizedAmount > 0 ? recognizedAmount : 1)
        const costPrice = shares > 0 ? safeDivide(costBasis, shares) : 0

        let markDate = ''
        if (costPrice > 0) {
          if (peekNavSeries(fund.fundCode).length === 0) {
            await fetchMissingPerf([fund.fundCode], () => {})
          }
          markDate = findDateByNav(peekNavSeries(fund.fundCode), costPrice)
        }

        holdingStore.addHoldingDirect(
          fund.fundCode, shares, costPrice, recognizedAmount, recognizedProfit,
          { gszzl: v?.gszzl, isEstimated: v?.isEstimated, jzrq: v?.jzrq },
          false, targetGroup, markDate || undefined,
        )
      }

      imported++
    }

    if (imported > 0) {
      void fundStore.refreshAllValuations()
    }
    return imported
  }

  function resetRecognition(): void {
    recognizedFunds.value = []
    status.value = 'idle'
    progress.value = { done: 0, total: 0 }
    errorMessage.value = ''
    abortControllers.value = []
  }

  return {
    recognizedFunds,
    status,
    progress,
    errorMessage,
    recognizeImages,
    cancelRecognition,
    importRecognized,
    resetRecognition,
  }
}
