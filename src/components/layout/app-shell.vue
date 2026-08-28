<template>
  <div class="app-shell" :class="{ 'shell-wide': isWide, 'shell-mobile': !isWide, 'shell-free': free }">
    <MainNav v-if="isWide && showNav" />
    <div class="shell-body">
      <slot />
    </div>
    <MainNav v-if="!isWide && showNav" />
  </div>
</template>
<script setup lang="ts">
import MainNav from '@/components/shared/bottom-nav.vue'
import { useLayoutMode } from './use-layout-mode'

defineProps<{
  showNav?: boolean

  free?: boolean
}>()

const { isWide } = useLayoutMode()
</script>
<style scoped>
.app-shell {
  display: flex;
  width: 100%;
  height: 100dvh;
  overflow: hidden;
  overscroll-behavior: none;
}

.shell-mobile {
  flex-direction: column;
  align-items: center;
}
.shell-mobile .shell-body {
  position: relative;
  background: var(--bg-base);
  flex: 1;
  min-height: 0;
  width: 100%;
  max-width: var(--content-max);
  overscroll-behavior: none;
}

@media (min-width: 768px) and (max-width: 1023px) {
  .shell-mobile .shell-body { max-width: 820px; }
}

.shell-wide {
  flex-direction: row;
}
.shell-wide .shell-body {
  position: relative;
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  justify-content: center;

  padding: 0 var(--spacing-md);
}
.shell-wide .shell-body > * {
  width: 100%;
  max-width: var(--content-max-wide);
}

/* 落地页要整页滚动，而 shell 默认锁死 100dvh + overflow:hidden。
   宽度上限同样解除，否则满屏视觉会被压进 960px 的内容栏。 */
.shell-free {
  height: auto;
  min-height: 100dvh;
  overflow: visible;
}
.shell-free .shell-body {
  max-width: none;
  padding: 0;
  display: block;
}
.shell-free .shell-body > * { max-width: none; }
</style>
