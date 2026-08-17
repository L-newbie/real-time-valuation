<template>
  <div class="news-page">
    <header class="news-header glass-card">
      <button class="back-btn" @click="goBack" aria-label="返回">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
      <div class="header-info">
        <span class="header-title" :title="title">{{ title }}</span>
        <span class="header-source">{{ source }}</span>
      </div>
      <a v-if="url" :href="url" target="_blank" rel="noopener" class="browser-btn" aria-label="浏览器打开">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      </a>
      <button class="close-btn" @click="goBack" aria-label="关闭">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </header>
    <div v-if="!url" class="empty-state">
      <span>暂无文章链接</span>
    </div>
    <div v-else class="iframe-wrap">
      <div v-if="loading && !loadTimeout" class="loading-overlay">
        <span class="loading-text">加载中...</span>
      </div>
      <div v-if="loadTimeout" class="fallback-overlay">
        <span class="fallback-text">加载超时</span>
        <a :href="url" target="_blank" rel="noopener" class="fallback-link">在浏览器中打开</a>
      </div>
      <iframe
        v-show="!loadTimeout"
        :src="url"
        class="news-iframe"
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms allow-modals allow-top-navigation-by-user-activation"
        @load="onIframeLoad"
        @error="onIframeError"
      />
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted, onUnmounted, onActivated, onDeactivated } from 'vue'
import { useRouter, useRoute } from 'vue-router'

defineOptions({ name: 'MarketNews' })

const router = useRouter()
const route = useRoute()

const title = ref('')
const source = ref('')
const url = ref('')
const loading = ref(true)
const loadTimeout = ref(false)

let timeoutTimer: number | null = null

function initFromRoute(): void {
  const q = route.query
  title.value = (q.title as string) || '资讯详情'
  source.value = (q.source as string) || ''
  const newUrl = (q.url as string) || ''

  if (newUrl !== url.value) {
    url.value = newUrl
    loading.value = true
    loadTimeout.value = false

    if (timeoutTimer !== null) clearTimeout(timeoutTimer)

    if (newUrl) {
      try {
        const domain = new URL(newUrl).origin
        const link = document.createElement('link')
        link.rel = 'preconnect'
        link.href = domain
        link.crossOrigin = 'anonymous'
        document.head.appendChild(link)
      } catch {  }

      timeoutTimer = window.setTimeout(() => {
        if (loading.value) {
          loadTimeout.value = true
          loading.value = false
        }
      }, 6000)
    } else {
      loading.value = false
    }
  }
}

onMounted(() => initFromRoute())
onActivated(() => initFromRoute())

onDeactivated(() => {
  if (timeoutTimer !== null) {
    clearTimeout(timeoutTimer)
    timeoutTimer = null
  }
})

onUnmounted(() => {
  if (timeoutTimer !== null) clearTimeout(timeoutTimer)
})

function onIframeLoad(): void {
  if (timeoutTimer !== null) clearTimeout(timeoutTimer)
  loading.value = false
}

function onIframeError(): void {
  if (timeoutTimer !== null) clearTimeout(timeoutTimer)
  loadTimeout.value = true
  loading.value = false
}

function goBack(): void {
  router.back()
}
</script>
<style scoped>
.news-page {
  display: flex;
  flex-direction: column;

  height: 100%;
}

.news-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  flex-shrink: 0;
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border-bottom: 1px solid var(--border-default);
}

.back-btn,
.close-btn,
.browser-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
  -webkit-tap-highlight-color: transparent;
  text-decoration: none;
}

.back-btn:hover,
.close-btn:hover,
.browser-btn:hover {
  background: var(--bg-card-hover);
}

.header-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 1px;
}

.header-title {
  font-size: var(--font-sm);
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.header-source {
  font-size: 11px;
  color: var(--text-muted);
}

.iframe-wrap {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.loading-overlay,
.fallback-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-md);
  background: var(--bg-base);
  z-index: 1;
}

.loading-text {
  font-size: var(--font-sm);
  color: var(--text-muted);
}

.fallback-text {
  font-size: var(--font-sm);
  color: var(--text-muted);
}

.fallback-link {
  font-size: var(--font-sm);
  color: var(--color-primary-light);
  text-decoration: underline;
}

.news-iframe {
  width: 100%;
  height: 100%;
  border: none;
  background: var(--bg-card);
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  font-size: var(--font-sm);
}
</style>
