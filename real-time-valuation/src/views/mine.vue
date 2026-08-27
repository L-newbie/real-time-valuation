<template>
  <Teleport to="body">
    <div v-if="visible" class="me-catch" @click="close" />
    <Transition name="me-panel">
      <div v-if="visible" class="me-panel" role="dialog" aria-modal="true" aria-label="我的">
        <div class="me-body">
      <NodeGraph
        ref="graphRef"
        :root="graphRoot"
        :height="graphHeight"
        @activate="onActivate"
      >
        <template #center="{ node, expanded, isRoot }">
          <span v-if="isRoot" class="me-center">
            <span class="me-avatar" :style="avatarStyle">
              <img v-if="avatar" :src="avatar" alt="" class="me-avatar-img" />
              <span v-else>{{ displayInitial }}</span>
            </span>
            <span class="me-center-name">{{ displayName }}</span>
            <span class="me-center-hint">{{ expanded ? '点击收起' : '点击展开' }}</span>
          </span>
          <span v-else class="me-center me-center-sub">
            <span v-if="node.icon" class="me-center-icon" v-html="node.icon" />
            <span class="me-center-name">{{ node.label }}</span>
            <span class="me-center-hint">返回上层</span>
          </span>
        </template>
      </NodeGraph>
        </div>
      </div>
    </Transition>
    <AvatarSheet
      v-model:visible="avatarSheet"
      :color="user.color"
      :initial="displayInitial"
      @updated="reloadProfile"
    />
    <NicknameSheet
      v-model:visible="nicknameSheet"
      :nickname="displayName"
      @updated="reloadProfile"
    />
    <FeedbackSheet v-model:visible="feedbackSheet" />
    <InfoSheet
      v-model:visible="infoSheet"
      v-bind="infoData"
      @action="onInfoAction"
    />
  </Teleport>
</template>
<script setup lang="ts">
defineOptions({ name: 'MinePanel' })

import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import NodeGraph from '@/components/shared/node-graph.vue'
import type { GraphNode } from '@/components/shared/node-graph.vue'
import AvatarSheet from '@/components/shared/avatar-sheet.vue'
import NicknameSheet from '@/components/shared/nickname-sheet.vue'
import InfoSheet from '@/components/shared/info-sheet.vue'
import FeedbackSheet from '@/components/shared/feedback-sheet.vue'
import type { InfoRow, InfoAction } from '@/components/shared/info-sheet.vue'
import { useRandomNickname } from '@/composables/use-random-nickname'
import { useFundStore } from '@/modules/fund/fund-store'
import { useCacheStore } from '@/modules/fund/cache-store'
import { useStockStore } from '@/modules/stock/stock-store'
import { useIndexStore } from '@/modules/index/index-store'
import { useSettingsStore } from '@/modules/settings/settings-store'
import { useHoldingStore } from '@/modules/holding/holding-store'
import { confirm } from '@/composables/use-confirm'
import { STORAGE_KEYS } from '@/config/constants'
import { loadString, loadJSON } from '@/shared/cache/local-storage-io'
import { useLayoutMode } from '@/components/layout/use-layout-mode'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ 'update:visible': [v: boolean] }>()

const router = useRouter()

function close(): void { emit('update:visible', false) }
const { user } = useRandomNickname()
const fundStore = useFundStore()
const stockStore = useStockStore()
const indexStore = useIndexStore()
const settingsStore = useSettingsStore()
const holdingStore = useHoldingStore()
const { isWide } = useLayoutMode()

const graphRef = ref<InstanceType<typeof NodeGraph> | null>(null)

const avatarSheet = ref(false)
const nicknameSheet = ref(false)
const infoSheet = ref(false)
const feedbackSheet = ref(false)
interface InfoPayload {
  title: string
  lead?: string
  icon?: string
  image?: string
  rows?: InfoRow[]
  paragraphs?: string[]
  actions?: InfoAction[]

  centerText?: boolean
}
const infoData = ref<InfoPayload>({ title: '' })

const actionPaths = ref<Record<string, string>>({})

const nameOverride = ref('')
const avatar = ref(loadString(STORAGE_KEYS.USER_AVATAR) || '')

const displayName = computed(() => nameOverride.value || user.value.nickname)
const displayInitial = computed(() => displayName.value.charAt(0))
const avatarStyle = computed(() => (avatar.value ? {} : { background: user.value.color }))

function reloadProfile(): void {
  const stored = loadJSON<{ nickname?: string } | null>(STORAGE_KEYS.RANDOM_NICKNAME, null)
  nameOverride.value = stored?.nickname || ''
  avatar.value = loadString(STORAGE_KEYS.USER_AVATAR) || ''
}
reloadProfile()

watch(() => props.visible, (v) => {
  if (v) graphRef.value?.reset()
})

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') close()
}
watch(() => props.visible, (v) => {
  if (v) document.addEventListener('keydown', onKeydown)
  else document.removeEventListener('keydown', onKeydown)
})

const graphHeight = computed(() => (isWide.value ? 380 : 320))

const ICON = 'width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"'

const appVersion = typeof __APP_RELEASE__ !== 'undefined' ? `v${__APP_RELEASE__}` : 'dev'

const graphRoot = computed<GraphNode>(() => ({
  id: 'me',
  label: displayName.value,
  children: [
    {
      id: 'profile',
      label: '我的资料',
      tone: 'mint',
      icon: `<svg ${ICON}><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/></svg>`,
      children: [
        { id: 'pf-avatar', label: '更换头像' },
        { id: 'pf-name', label: '修改昵称' },
        { id: 'pf-login', label: '登录', disabled: true },
        { id: 'pf-register', label: '注册', disabled: true },
      ],
    },
    {
      id: 'settings',
      label: '设置',
      tone: 'accent',
      icon: `<svg ${ICON}><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/></svg>`,
      children: [
        {
          id: 's-theme',
          label: '主题',

          children: [
            { id: 'theme-dark', label: '暗色', selected: settingsStore.theme === 'dark' },
            { id: 'theme-light', label: '亮色', selected: settingsStore.theme === 'light' },
          ],
        },
        {
          id: 's-fund',
          label: '基金专项',
          children: [
            { id: 'fd-manager', label: '经理变更检测', selected: settingsStore.enableManagerCheck },
            { id: 'fd-realtime', label: '实时涨跌幅', selected: settingsStore.enablePrediction },
          ],
        },
      ],
    },
    {
      id: 'd-cache',
      label: '清除缓存',
      icon: `<svg ${ICON}><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></svg>`,
    },
    {
      id: 'feedback',
      label: '问题反馈',
      icon: `<svg ${ICON}><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z"/></svg>`,
    },
    {
      id: 'charity',
      label: '公益',
      tone: 'mint',
      icon: `<svg ${ICON}><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21.2l7.8-7.8 1.1-1.1a5.5 5.5 0 0 0 0-7.8z"/></svg>`,
    },
    {
      id: 'about',
      label: '关于',
      icon: `<svg ${ICON}><circle cx="12" cy="12" r="9"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
    },
  ],
}))

function showInfo(payload: InfoPayload, paths: Record<string, string> = {}): void {
  infoData.value = payload
  actionPaths.value = paths
  infoSheet.value = true
}

function onInfoAction(key: string): void {
  const path = actionPaths.value[key]
  infoSheet.value = false
  if (path) { close(); router.push(path) }
}

function onActivate(node: GraphNode): void {
  const id = node.id

  if (id === 'pf-avatar') { avatarSheet.value = true; return }
  if (id === 'pf-name') { nicknameSheet.value = true; return }

  if (id === 'theme-dark') { settingsStore.theme = 'dark'; return }
  if (id === 'theme-light') { settingsStore.theme = 'light'; return }

  if (id === 'fd-manager') { settingsStore.enableManagerCheck = !settingsStore.enableManagerCheck; return }
  if (id === 'fd-realtime') { settingsStore.enablePrediction = !settingsStore.enablePrediction; return }

  if (id.startsWith('d-')) { onClean(id); return }

  if (id === 'about') {
    showInfo({
      title: '关于基攻宝',
      lead: '基金实时估值工具，数据仅供参考，不构成投资建议',
      icon: `<svg ${ICON}><circle cx="12" cy="12" r="9"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
      rows: [
        { label: '版本', value: appVersion },
        { label: '数据来源', value: '天天基金 · 东方财富 · 新浪财经', numeric: false },
        {
          label: '开源仓库',
          value: 'GitHub',
          numeric: false,
          href: 'https://github.com/L-newbie/real-time-valuation',
        },
      ],
      paragraphs: [
        '本应用提供的基金估值、股票行情、财经资讯等数据均来自公开第三方数据源，仅供学习研究参考，不构成任何投资建议。',
        '数据可能存在延迟或误差，请以官方披露为准。据此操作风险自负。',
      ],
    })
    return
  }

  if (id === 'charity') {
    showInfo({
      title: '请作者喝杯奶茶',
      lead: '随心就好，感谢你的心意 ☕',
      icon: `<svg ${ICON}><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21.2l7.8-7.8 1.1-1.1a5.5 5.5 0 0 0 0-7.8z"/></svg>`,
      image: `${import.meta.env.BASE_URL}charity-qr.webp`,
      paragraphs: ['长按或截图保存收款码，用微信 / 支付宝扫码。'],

      centerText: true,
    })
    return
  }

  if (id === 'feedback') { feedbackSheet.value = true; return }

  if (node.path) {
    close()
    router.push(node.path)
  }
}

async function onClean(id: string): Promise<void> {
  function purgeCaches(): void {
    useCacheStore().clearAllCache()
    fundStore.clearCacheDataInMemory()
    localStorage.removeItem(STORAGE_KEYS.INDEX_QUOTES_CACHE)
    localStorage.removeItem(STORAGE_KEYS.INDEX_QUOTES_DATE)

    const alive = new Set(fundStore.fundCodes)
    for (const code of holdingStore.holdings.map(h => h.fundCode)) {
      if (!alive.has(code)) holdingStore.removeHoldingsByFund(code)
    }

    ;(window as unknown as { __skipPersistOnUnload?: boolean }).__skipPersistOnUnload = true
  }

  const PLANS: Record<string, { title: string; desc: string; reload?: boolean; run: () => void }> = {
    'd-cache': {
      title: '清除缓存',
      desc: '清除本地行情与净值缓存，并清理无主的残留持仓记录。清理后会自动刷新页面重新拉取，关注与持仓不受影响。',
      reload: true,
      run: purgeCaches,
    },
  }
  const plan = PLANS[id]
  if (!plan) return
  const ok = await confirm({
    title: plan.title,
    desc: plan.desc,
    confirmText: '确认清除',
    cancelText: '取消',
  })
  if (!ok) return
  plan.run()
  ElMessage.success('已清除')
  if (plan.reload) setTimeout(() => window.location.reload(), 400)
}
</script>
<style scoped>

.me-catch {
  position: fixed;
  inset: 0;
  z-index: var(--z-overlay);
  background: rgba(0, 0, 0, 0.18);
  backdrop-filter: blur(6px) saturate(120%);
  -webkit-backdrop-filter: blur(6px) saturate(120%);
}

.me-panel {
  position: fixed;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  z-index: var(--z-modal);
  width: min(460px, calc(100vw - var(--spacing-lg) * 2));

  padding: var(--spacing-lg) var(--spacing-md) var(--spacing-md);
  background: transparent;
}

.me-body {
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.me-panel-enter-active {
  transition: opacity var(--duration-fast) var(--ease-out-expo),
              transform var(--duration-fast) var(--ease-out-expo);
}
.me-panel-leave-active {
  transition: opacity var(--duration-micro) var(--ease-smooth),
              transform var(--duration-micro) var(--ease-smooth);
}
.me-panel-enter-from,
.me-panel-leave-to {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.94);
}

.me-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-width: 118px;
  padding: var(--spacing-md);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-xl);

  background: linear-gradient(150deg, var(--color-primary-glow), var(--bg-card) 60%);
  box-shadow: 0 0 0 1px var(--color-primary-glow), var(--shadow-lg);
}

.me-center-sub { gap: 3px; min-width: 104px; padding: var(--spacing-md) var(--spacing-sm); }

.me-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 46px;
  border-radius: var(--radius-full);
  overflow: hidden;
  font-size: var(--font-lg);
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}
.me-avatar-img { width: 100%; height: 100%; object-fit: cover; }

.me-center-icon { display: inline-flex; color: var(--color-primary); }
.me-center-name {
  font-size: var(--font-sm);
  font-weight: 700;
  color: var(--text-primary);
  max-width: 130px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.me-center-hint { font-size: 10px; color: var(--text-muted); }

@media (max-width: 767px) {
  .me-panel { padding: var(--spacing-md) var(--spacing-sm) var(--spacing-sm); }
  .me-center { min-width: 106px; padding: var(--spacing-sm) var(--spacing-md); }
  .me-center-sub { min-width: 96px; }
  .me-avatar { width: 42px; height: 42px; font-size: var(--font-md); }
}
</style>
