<template>
  <Teleport to="body">
    <div v-if="visible" class="notice-overlay" @click.self="handleClose">
      <div class="notice-card glass-card">
        <button class="notice-close" @click="handleClose" title="关闭">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <div class="notice-header">
          <div class="notice-icon" :class="`notice-icon-${tone}`">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <span class="notice-title">{{ title }}</span>
        </div>
        <div class="notice-body">
          <p v-if="desc" class="notice-desc">{{ desc }}</p>
          <slot />
        </div>
        <div class="notice-footer">
          <button class="notice-confirm" @click="handleClose">{{ confirmText }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
<script setup lang="ts">

defineOptions({ name: 'NoticeModal' })

withDefaults(defineProps<{
  visible: boolean
  title: string
  desc?: string
  confirmText?: string

  tone?: 'info' | 'warn'
}>(), {
  desc: '',
  confirmText: '我知道了',
  tone: 'info',
})

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'close'): void
}>()

function handleClose(): void {
  emit('update:visible', false)
  emit('close')
}
</script>
<style scoped>
.notice-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  animation: notice-fade-in 0.2s ease;
}
@keyframes notice-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

.notice-card {
  position: relative;
  width: 420px;
  max-width: calc(100vw - 32px);
  padding: var(--spacing-lg);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  animation: notice-in 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes notice-in {
  from { opacity: 0; transform: scale(0.95) translateY(8px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}

.notice-close {
  position: absolute;
  top: var(--spacing-sm);
  right: var(--spacing-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}
.notice-close:hover {
  color: var(--text-primary);
  background: var(--bg-card-hover);
}

.notice-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding-right: 28px;
}
.notice-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.notice-title {
  font-size: var(--font-md);
  font-weight: 600;
  color: var(--text-primary);
}

.notice-body {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}
.notice-desc {
  font-size: var(--font-sm);
  color: var(--text-secondary);
  line-height: 1.6;
  margin: 0;
}

.notice-body :deep(p) {
  font-size: var(--font-sm);
  color: var(--text-secondary);
  line-height: 1.6;
  margin: 0;
}
.notice-body :deep(p + p) {
  margin-top: var(--spacing-sm);
}
.notice-body :deep(strong) {
  color: var(--text-primary);
  font-weight: 600;
}

.notice-footer {
  display: flex;
  justify-content: flex-end;
}
.notice-confirm {
  padding: 8px 24px;
  border-radius: var(--radius-md);
  border: none;
  background: var(--accent-gradient);
  color: #fff;
  font-size: var(--font-sm);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
  font-family: inherit;
}
.notice-confirm:hover {
  background: var(--accent-gradient-hover);
  box-shadow: var(--shadow-glow);
  transform: translateY(-1px);
}
</style>
