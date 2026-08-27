

import { ref, computed, onMounted, onUnmounted } from 'vue'

const MOBILE_QUERY = '(max-width: 767px)'

export const WIDE_QUERY = '(min-width: 1024px)'
const XWIDE_QUERY = '(min-width: 1600px)'

export function useLayoutMode() {
  const isMobile = ref(false)

  const isWide = ref(false)

  const isXWide = ref(false)

  const isTablet = computed(() => !isMobile.value && !isWide.value)

  let mobileMql: MediaQueryList | null = null
  let wideMql: MediaQueryList | null = null
  let xwideMql: MediaQueryList | null = null

  function onMobile(e: MediaQueryListEvent | MediaQueryList) { isMobile.value = e.matches }
  function onWide(e: MediaQueryListEvent | MediaQueryList) { isWide.value = e.matches }
  function onXWide(e: MediaQueryListEvent | MediaQueryList) { isXWide.value = e.matches }

  onMounted(() => {
    mobileMql = window.matchMedia(MOBILE_QUERY)
    wideMql = window.matchMedia(WIDE_QUERY)
    xwideMql = window.matchMedia(XWIDE_QUERY)

    onMobile(mobileMql)
    onWide(wideMql)
    onXWide(xwideMql)

    mobileMql.addEventListener('change', onMobile)
    wideMql.addEventListener('change', onWide)
    xwideMql.addEventListener('change', onXWide)
  })

  onUnmounted(() => {
    mobileMql?.removeEventListener('change', onMobile)
    wideMql?.removeEventListener('change', onWide)
    xwideMql?.removeEventListener('change', onXWide)
  })

  return { isMobile, isTablet, isWide, isXWide }
}
