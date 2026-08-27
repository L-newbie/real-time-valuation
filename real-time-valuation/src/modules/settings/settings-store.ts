

import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { STORAGE_KEYS } from '@/config/constants'
import { loadJSON, saveJSON } from '@/shared/cache/local-storage-io'
import { runThemeTransition } from '@/shared/theme/theme-transition'

export type ThemeMode = 'dark' | 'light'
export type RefreshIntervalOption = 5 | 10 | 15 | 30 | 60 | 120 | 300

export interface PrivacySettings {
  holding: boolean

  todayProfit: boolean

  todayRate: boolean

  totalProfit: boolean

  totalRate: boolean
}

export interface UserSettings {
  theme: ThemeMode
  autoRefresh: boolean
  marketAutoRefresh: boolean
  sectorAutoRefresh: boolean
  refreshInterval: RefreshIntervalOption
  marketRefreshInterval: RefreshIntervalOption
  sectorRefreshInterval: RefreshIntervalOption
  newsAutoRefresh: boolean
  newsRefreshInterval: RefreshIntervalOption
  enableManagerCheck: boolean

  enablePrediction: boolean
  privacy: PrivacySettings
}

const DEFAULT_SETTINGS: UserSettings = {
  theme: 'dark',
  autoRefresh: true,
  marketAutoRefresh: true,
  sectorAutoRefresh: true,
  refreshInterval: 5,
  marketRefreshInterval: 60,
  sectorRefreshInterval: 60,
  newsAutoRefresh: true,
  newsRefreshInterval: 120,
  enableManagerCheck: true,
  enablePrediction: true,
  privacy: {
    holding: true, todayProfit: true, todayRate: true, totalProfit: true, totalRate: true,
  },
}

function migratePrivacy(old: Record<string, boolean> | undefined): PrivacySettings {
  const d = DEFAULT_SETTINGS.privacy
  if (!old) return { ...d }
  const hasOld = 'dashboard_holding' in old || 'list_holding' in old
  if (!hasOld) return { ...d, ...old }
  return {
    holding:     old.dashboard_holding   ?? old.list_holding      ?? d.holding,
    todayProfit: old.dashboard_today     ?? old.list_today_amount ?? d.todayProfit,
    todayRate:   old.dashboard_rates     ?? old.list_today_rate   ?? d.todayRate,
    totalProfit: old.dashboard_total     ?? old.list_total_amount ?? d.totalProfit,
    totalRate:   old.dashboard_rates     ?? old.list_total_amount ?? d.totalRate,
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const stored = loadJSON<Partial<UserSettings>>(STORAGE_KEYS.USER_SETTINGS, {})

  const storedTheme = stored.theme === 'light' || stored.theme === 'dark'
    ? stored.theme
    : (stored.theme === undefined ? DEFAULT_SETTINGS.theme : 'light')
  const theme = ref<ThemeMode>(storedTheme)
  const autoRefresh = ref<boolean>(stored.autoRefresh ?? DEFAULT_SETTINGS.autoRefresh)
  const marketAutoRefresh = ref<boolean>(stored.marketAutoRefresh ?? DEFAULT_SETTINGS.marketAutoRefresh)
  const sectorAutoRefresh = ref<boolean>(stored.sectorAutoRefresh ?? DEFAULT_SETTINGS.sectorAutoRefresh)
  const refreshInterval = ref<RefreshIntervalOption>(stored.refreshInterval ?? DEFAULT_SETTINGS.refreshInterval)
  const marketRefreshInterval = ref<RefreshIntervalOption>(stored.marketRefreshInterval ?? DEFAULT_SETTINGS.marketRefreshInterval)
  const sectorRefreshInterval = ref<RefreshIntervalOption>(stored.sectorRefreshInterval ?? DEFAULT_SETTINGS.sectorRefreshInterval)
  const newsAutoRefresh = ref<boolean>(stored.newsAutoRefresh ?? DEFAULT_SETTINGS.newsAutoRefresh)
  const newsRefreshInterval = ref<RefreshIntervalOption>(stored.newsRefreshInterval ?? DEFAULT_SETTINGS.newsRefreshInterval)
  const enableManagerCheck = ref<boolean>(stored.enableManagerCheck ?? DEFAULT_SETTINGS.enableManagerCheck)
  const enablePrediction = ref<boolean>(stored.enablePrediction ?? DEFAULT_SETTINGS.enablePrediction)
  const privacy = ref<PrivacySettings>(migratePrivacy(stored.privacy as Record<string, boolean> | undefined))

  function toObject(): UserSettings {
    return {
      theme: theme.value, autoRefresh: autoRefresh.value,
      marketAutoRefresh: marketAutoRefresh.value, sectorAutoRefresh: sectorAutoRefresh.value,
      refreshInterval: refreshInterval.value, marketRefreshInterval: marketRefreshInterval.value,
      sectorRefreshInterval: sectorRefreshInterval.value,
      newsAutoRefresh: newsAutoRefresh.value,
      newsRefreshInterval: newsRefreshInterval.value,
      enableManagerCheck: enableManagerCheck.value, enablePrediction: enablePrediction.value,
      privacy: { ...privacy.value },
    }
  }

  function persist(): void {
    saveJSON(STORAGE_KEYS.USER_SETTINGS, toObject())
  }

  const fields = [theme, autoRefresh, marketAutoRefresh, sectorAutoRefresh, refreshInterval,
    marketRefreshInterval, sectorRefreshInterval, newsAutoRefresh,
    newsRefreshInterval, enableManagerCheck, enablePrediction]
  for (const field of fields) watch(field, () => persist(), { deep: false })
  watch(privacy, () => persist(), { deep: true })

  function resetToDefaults(): void {
    theme.value = DEFAULT_SETTINGS.theme
    autoRefresh.value = DEFAULT_SETTINGS.autoRefresh
    marketAutoRefresh.value = DEFAULT_SETTINGS.marketAutoRefresh
    sectorAutoRefresh.value = DEFAULT_SETTINGS.sectorAutoRefresh
    refreshInterval.value = DEFAULT_SETTINGS.refreshInterval
    marketRefreshInterval.value = DEFAULT_SETTINGS.marketRefreshInterval
    sectorRefreshInterval.value = DEFAULT_SETTINGS.sectorRefreshInterval
    newsAutoRefresh.value = DEFAULT_SETTINGS.newsAutoRefresh
    newsRefreshInterval.value = DEFAULT_SETTINGS.newsRefreshInterval
    enableManagerCheck.value = DEFAULT_SETTINGS.enableManagerCheck
    enablePrediction.value = DEFAULT_SETTINGS.enablePrediction
    privacy.value = { ...DEFAULT_SETTINGS.privacy }
  }

  const privacyState = computed<'all-visible' | 'partial' | 'all-hidden'>(() => {
    const vals = Object.values(privacy.value)
    if (vals.every(v => v)) return 'all-visible'
    if (vals.every(v => !v)) return 'all-hidden'
    return 'partial'
  })

  function showAllPrivacy(): void {
    const keys = Object.keys(privacy.value) as (keyof PrivacySettings)[]
    keys.forEach(k => { privacy.value[k] = true })
  }
  function hideAllPrivacy(): void {
    const keys = Object.keys(privacy.value) as (keyof PrivacySettings)[]
    keys.forEach(k => { privacy.value[k] = false })
  }

  function applyTheme(t: ThemeMode): void {
    const html = document.documentElement
    if (html.classList.contains(t)) return
    html.classList.remove('dark', 'light')
    html.classList.add(t)
    if (t === 'dark') html.style.colorScheme = 'dark'
    else html.style.colorScheme = 'light'
  }
  function initTheme(): void { applyTheme(theme.value) }
  function toggleTheme(): void {
    setTheme(theme.value === 'dark' ? 'light' : 'dark')
  }

  function setTheme(t: ThemeMode): void {
    if (t === theme.value) return
    runThemeTransition(() => {
      theme.value = t
      applyTheme(t)
    })
  }
  watch(theme, (t) => applyTheme(t))

  return {
    theme, autoRefresh, marketAutoRefresh, sectorAutoRefresh, refreshInterval,
    marketRefreshInterval, sectorRefreshInterval, newsAutoRefresh,
    newsRefreshInterval, enableManagerCheck, enablePrediction, privacy,
    toObject, persist, resetToDefaults, initTheme, toggleTheme, setTheme, applyTheme,
    privacyState, showAllPrivacy, hideAllPrivacy,
  }
})
