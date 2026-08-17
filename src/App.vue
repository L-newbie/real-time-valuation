<template>
  <AppShell id="app" :show-nav="showBottomNav" :free="isLanding">
    <router-view v-slot="{ Component }">
      <transition :name="transitionName" mode="default">
        <keep-alive :max="6">
          <component :is="Component" />
        </keep-alive>
      </transition>
    </router-view>
  </AppShell>
  <ConfirmModal
    :visible="confirmState.visible"
    :title="confirmState.title"
    :desc="confirmState.desc"
    :confirm-text="confirmState.confirmText"
    :cancel-text="confirmState.cancelText"
    :items="confirmState.items"
    @confirm="resolveConfirm"
    @cancel="resolveCancel"
    @update:visible="resolveCancel"
  />
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppShell from '@/components/layout/app-shell.vue'
import ConfirmModal from '@/components/shared/confirm-modal.vue'
import { useConfirmState, resolveConfirm, resolveCancel } from '@/composables/use-confirm'

const route = useRoute()
const confirmState = useConfirmState()

const TAB_ROOT_PATHS = ['/', '/groups', '/market']
const showBottomNav = computed(() => TAB_ROOT_PATHS.includes(route.path))

const isLanding = computed(() => route.path === '/landing')

function depthOf(path: string): number {
  if (path === '/') return 0
  return path.split('/').filter(Boolean).length
}

const transitionName = ref('route-fade')
watch(() => route.path, (to, from) => {
  if (from == null) { transitionName.value = 'route-fade'; return }
  const d = depthOf(to) - depthOf(from)
  transitionName.value = d > 0 ? 'route-fwd' : d < 0 ? 'route-back' : 'route-fade'
})
</script>
