<template>
  <Teleport to="body">
    <div v-if="visible" class="modal-overlay" @click.self="handleCancel">
      <div class="modal-card glass-card">
        <div class="modal-header">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-rise)" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span class="modal-title">{{ title }}</span>
        </div>
        <div class="modal-body">
          <p v-if="desc" class="modal-desc">{{ desc }}</p>
          <ul v-if="items && items.length" class="modal-list">
            <li v-for="(item, i) in items" :key="i">
              <span class="modal-list-dot"></span>
              <span class="modal-list-label">{{ item.label }}</span>
              <span v-if="item.desc" class="modal-list-desc">{{ item.desc }}</span>
            </li>
          </ul>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" @click="handleCancel" :disabled="loading">{{ cancelText }}</button>
          <button class="btn-confirm" @click="handleConfirm" :disabled="loading">
            {{ loading ? '处理中...' : confirmText }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
<script setup lang="ts">

export interface ConfirmItem {
  label: string
  desc?: string
}

const props = withDefaults(defineProps<{
  visible: boolean
  title: string
  desc?: string
  confirmText?: string
  cancelText?: string
  loading?: boolean
  items?: ConfirmItem[]
}>(), {
  desc: '',
  confirmText: '确认',
  cancelText: '取消',
  loading: false,
  items: () => [],
})

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()

function close(): void {
  emit('update:visible', false)
}

function handleConfirm(): void {
  if (props.loading) return
  emit('confirm')
}

function handleCancel(): void {
  if (props.loading) return
  emit('cancel')
  close()
}
</script>
<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  animation: fade-in 0.2s ease;
}
@keyframes fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
.modal-card {
  width: 400px;
  max-width: calc(100vw - 32px);
  padding: var(--spacing-lg);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  animation: modal-in 0.25s ease;
  border: 1px solid var(--color-rise-glow);
}
@keyframes modal-in {
  from { opacity: 0; transform: scale(0.95) translateY(8px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}
.modal-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}
.modal-title {
  font-size: var(--font-md);
  font-weight: 600;
  color: var(--text-primary);
}
.modal-body {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}
.modal-desc {
  font-size: var(--font-sm);
  color: var(--text-muted);
  line-height: 1.5;
  margin: 0;
}
.modal-list {
  list-style: none;
  padding: var(--spacing-sm);
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: var(--bg-surface);
  border-radius: var(--radius-md);
}
.modal-list li {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}
.modal-list-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-rise);
  flex-shrink: 0;
}
.modal-list-label {
  font-size: var(--font-sm);
  color: var(--text-primary);
  font-weight: 500;
  white-space: nowrap;
}
.modal-list-desc {
  font-size: 11px;
  color: var(--text-muted);
}
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
}
.btn-cancel {
  padding: 8px 20px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--font-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}
.btn-cancel:hover:not(:disabled) {
  border-color: var(--border-hover);
  background: var(--bg-card-hover);
}
.btn-cancel:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn-confirm {
  padding: 8px 20px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-rise);
  background: var(--color-rise);
  color: #fff;
  font-size: var(--font-sm);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
}
.btn-confirm:hover:not(:disabled) {
  background: #dc2626;
  border-color: #dc2626;
}
.btn-confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
