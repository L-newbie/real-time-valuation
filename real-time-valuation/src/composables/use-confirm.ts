

import { reactive } from 'vue'
import type { ConfirmItem } from '@/components/shared/confirm-modal.vue'

export interface ConfirmOptions {
  title: string
  desc?: string
  confirmText?: string
  cancelText?: string
  items?: ConfirmItem[]
}

interface ConfirmState extends ConfirmOptions {
  visible: boolean
  resolver: ((ok: boolean) => void) | null
}

const state = reactive<ConfirmState>({
  visible: false,
  title: '',
  desc: '',
  confirmText: '确认',
  cancelText: '取消',
  items: [],
  resolver: null,
})

export function useConfirmState() {
  return state
}

export function confirm(options: ConfirmOptions): Promise<boolean> {
  if (state.resolver) {
    state.resolver(false)
    state.resolver = null
  }
  return new Promise<boolean>((resolve) => {
    state.title = options.title
    state.desc = options.desc ?? ''
    state.confirmText = options.confirmText ?? '确认'
    state.cancelText = options.cancelText ?? '取消'
    state.items = options.items ?? []
    state.resolver = resolve
    state.visible = true
  })
}

export function resolveConfirm(): void {
  if (!state.resolver) return
  const r = state.resolver
  state.resolver = null
  state.visible = false
  r(true)
}

export function resolveCancel(): void {
  if (!state.resolver) return
  const r = state.resolver
  state.resolver = null
  state.visible = false
  r(false)
}
