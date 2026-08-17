<template>
  <nav
    class="main-nav"
    :class="isWide ? 'nav-rail' : 'nav-capsule glass-card'"
    aria-label="主导航"
  >
    <div
      v-if="!isWide"
      class="nav-thumb"
      :style="{
        width: `${100 / NAV_ITEMS.length}%`,
        transform: `translate3d(${activeIndex * 100}%, 0, 0)`,
      }"
      aria-hidden="true"
    />
    <router-link
      v-for="(item, i) in NAV_ITEMS"
      :key="item.path"
      :to="item.path"
      replace
      class="nav-item"
      :class="{ active: activeIndex === i }"
      :title="item.label"
    >
      <span class="nav-icon" v-html="item.icon" />
      <span class="nav-label">{{ item.label }}</span>
    </router-link>
  </nav>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useLayoutMode } from '@/components/layout/use-layout-mode'

const route = useRoute()
const { isWide } = useLayoutMode()

const ICON_ATTRS = 'width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"'

const NAV_ITEMS = [
  {
    path: '/groups',
    label: '汇总',

    icon: `<svg ${ICON_ATTRS}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>`,
  },
  {
    path: '/',
    label: '基金',

    icon: `<svg ${ICON_ATTRS}><path d="M3 8.5A2.5 2.5 0 0 1 5.5 6H18a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3Z"/><path d="M3 8.5V7a2 2 0 0 1 2-2h10"/><path d="M16.5 13.5h.01"/></svg>`,
  },
  {
    path: '/market',
    label: '仓库',

    icon: `<svg ${ICON_ATTRS}><rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 11h18"/><path d="M11 11v9"/></svg>`,
  },
]

const activeIndex = computed(() => {
  const p = route.path
  if (p.startsWith('/groups')) return 0
  if (p.startsWith('/market') || p.startsWith('/news')) return 2
  return 1
})
</script>
<style scoped>

.nav-capsule {
  position: fixed;
  bottom: calc(var(--spacing-md) + env(safe-area-inset-bottom, 0px));

  left: var(--spacing-md);
  right: var(--spacing-md);
  margin: 0 auto;
  width: fit-content;
  min-width: 260px;
  max-width: calc(100vw - var(--spacing-md) * 2);
  z-index: var(--z-fixed);

  display: flex;
  align-items: center;
  padding: 4px;
  border-radius: var(--radius-full);
  isolation: isolate;
  overflow: hidden;
}

.nav-thumb {
  position: absolute;
  top: 4px;
  bottom: 4px;
  left: 4px;
  margin-right: 8px;
  border-radius: var(--radius-full);
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  transition: transform var(--duration-fast) var(--ease-out-expo);
  will-change: transform;
  z-index: 0;
}

.nav-capsule .nav-item {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: var(--spacing-sm) var(--spacing-lg);
  border-radius: var(--radius-full);
  color: var(--text-muted);
  text-decoration: none;
  white-space: nowrap;
  transition: color var(--duration-fast) var(--ease-out-expo);
}
.nav-capsule .nav-item.active { color: var(--text-primary); }
.nav-capsule .nav-item:hover { color: var(--text-secondary); }
.nav-capsule .nav-item.active:hover { color: var(--text-primary); }

.nav-capsule .nav-icon {
  display: inline-flex;
  transition: transform var(--duration-fast) var(--ease-spring);
}
.nav-capsule .nav-item.active .nav-icon { transform: scale(1.06); }

.nav-capsule .nav-label {
  font-size: var(--font-xs);
  font-weight: 600;
}

@media (max-width: 380px) {
  .nav-capsule .nav-label { display: none; }
  .nav-capsule .nav-item { padding: var(--spacing-sm) var(--spacing-lg); }
}

.nav-rail {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-md) var(--spacing-sm);
  width: 76px;
  flex-shrink: 0;
  border-right: 1px solid var(--border-subtle);
  background: var(--bg-surface);
}

.nav-rail .nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  width: 100%;
  padding: var(--spacing-sm) 0;
  border-radius: var(--radius-md);
  color: var(--text-muted);
  text-decoration: none;
  transition: color var(--duration-fast) var(--ease-out-expo),
              background-color var(--duration-fast) var(--ease-out-expo);
}
.nav-rail .nav-item:hover {
  color: var(--text-secondary);
  background: var(--bg-card);
}
.nav-rail .nav-item.active {
  color: var(--color-primary);
  background: var(--color-primary-glow);
}
.nav-rail .nav-label {
  font-size: 11px;
  font-weight: 600;
}

</style>
