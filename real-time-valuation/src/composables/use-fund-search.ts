

import { ref, watch } from 'vue'
import { searchFunds } from '@/modules/fund/catalog/fund-search'
import type { SearchResult } from '@/modules/fund/fund-types'
import { isValidFundCode } from '@/shared/utils/validation'

export function useFundSearch() {
  const keyword = ref('')

  const results = ref<SearchResult[]>([])

  const searching = ref(false)

  let debounceTimer: number | null = null

  async function doSearch(query: string): Promise<void> {
    if (!query || query.trim().length < 2) {
      results.value = []
      return
    }

    searching.value = true
    try {
      results.value = await searchFunds(query.trim())
    } catch {
      results.value = []
    } finally {
      searching.value = false
    }
  }

  watch(keyword, (newVal) => {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = window.setTimeout(() => {
      doSearch(newVal)
    }, 300)
  })

  function clearSearch(): void {
    keyword.value = ''
    results.value = []
    if (debounceTimer) clearTimeout(debounceTimer)
  }

  function isDirectCode(input: string): boolean {
    return isValidFundCode(input.trim())
  }

  return {
    keyword,
    results,
    searching,
    clearSearch,
    isDirectCode,
  }
}
