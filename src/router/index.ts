

import { createRouter, createWebHashHistory } from 'vue-router'
import { STORAGE_KEYS } from '@/config/constants'
import { loadString, saveString, hasSessionFlag, setSessionFlag } from '@/shared/cache/local-storage-io'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'Home',
      component: () => import('@/views/home.vue'),
    },
    {
      path: '/landing',
      name: 'Landing',
      component: () => import('@/views/landing.vue'),
    },
    {
      path: '/groups',
      name: 'GroupsSummary',
      component: () => import('@/views/groups-summary.vue'),
    },
    {
      path: '/charity',
      name: 'Charity',
      component: () => import('@/views/charity.vue'),
    },
    {
      path: '/market',
      name: 'Market',
      component: () => import('@/views/stock-news-hub.vue'),
    },
    {
      path: '/news/detail',
      name: 'NewsDetail',
      component: () => import('@/views/market-news.vue'),
    },
    {
      path: '/login',
      name: 'Login',
      component: () => import('@/views/login.vue'),
    },
    {
      path: '/register',
      name: 'Register',
      component: () => import('@/views/register.vue'),
    },
    {
      path: '/settings',
      name: 'Settings',
      component: () => import('@/views/settings.vue'),
    },
    {
      path: '/settings/data',
      name: 'DataManagement',
      component: () => import('@/views/settings/data-management.vue'),
    },
    {
      path: '/settings/about',
      name: 'About',
      component: () => import('@/views/settings/about.vue'),
    },
    {
      path: '/settings/indices',
      name: 'IndicesSettings',
      component: () => import('@/views/settings/indices-settings.vue'),
    },
    {
      path: '/manage',
      name: 'Manage',
      component: () => import('@/views/manage.vue'),
    },
    {
      path: '/fund/:code',
      name: 'FundDetail',
      component: () => import('@/views/fund-detail.vue'),
    },
    {
      path: '/feedback',
      name: 'Feedback',
      component: () => import('@/views/feedback.vue'),
    },
    {
      path: '/games/cicada',
      name: 'GameCicada',
      component: () => import('@/views/games/cicada.vue'),
    },
  ],
})

// 首次进入先看落地页，看过一次就不再打扰；手机端与电脑端一致。
export function shouldShowLanding(): boolean {
  return loadString(STORAGE_KEYS.LANDING_SEEN) !== '1'
}

export function markLandingSeen(): void {
  saveString(STORAGE_KEYS.LANDING_SEEN, '1')
}

// 只拦冷启动那一次，应用内的任何跳转都不受影响。
let coldStart = true

router.beforeEach((to) => {
  const first = coldStart
  coldStart = false

  if (!first || to.path !== '/') return true
  if (hasSessionFlag(STORAGE_KEYS.LANDING_SEEN)) return true
  if (!shouldShowLanding()) return true

  markLandingSeen()
  setSessionFlag(STORAGE_KEYS.LANDING_SEEN)
  return { path: '/landing' }
})

router.afterEach((to) => {
  if (to.path === '/landing') markLandingSeen()
})

export default router
