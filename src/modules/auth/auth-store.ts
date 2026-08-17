

import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { STORAGE_KEYS, AUTH_CONFIG } from '@/config/constants'
import { loadJSON, saveJSON } from '@/shared/cache/local-storage-io'
import { randomSalt, hashPassword, verifyPassword } from './crypto'
import type { AuthUser, AuthSession, StoredAuth } from './auth-types'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim())
}

export const useAuthStore = defineStore('auth', () => {
  const stored = loadJSON<StoredAuth>(STORAGE_KEYS.AUTH, { users: [], session: null })
  const users = ref<AuthUser[]>(Array.isArray(stored.users) ? stored.users : [])
  const session = ref<AuthSession | null>(stored.session ?? null)

  const currentUser = computed<AuthUser | null>(() => {
    if (!session.value) return null
    return users.value.find(u => u.email === session.value!.email) ?? null
  })

  const isLoggedIn = computed<boolean>(() => currentUser.value != null)

  function persist(): void {
    saveJSON(STORAGE_KEYS.AUTH, { users: users.value, session: session.value })
  }

  watch([users, session], () => persist(), { deep: true })

  async function register(email: string, password: string, nickname: string): Promise<{ ok: boolean; error?: string }> {
    const e = email.trim().toLowerCase()
    if (!isValidEmail(e)) return { ok: false, error: '邮箱格式不正确' }
    if (password.length < AUTH_CONFIG.PASSWORD_MIN_LEN) {
      return { ok: false, error: `密码至少 ${AUTH_CONFIG.PASSWORD_MIN_LEN} 位` }
    }
    if (users.value.some(u => u.email === e)) {
      return { ok: false, error: '该邮箱已注册，请直接登录' }
    }
    const salt = randomSalt()
    const passwordHash = await hashPassword(password, salt)
    const nick = nickname.trim() || e.split('@')[0]
    const user: AuthUser = {
      email: e,
      nickname: nick,
      passwordHash,
      salt,
      createdAt: Date.now(),
    }
    users.value = [...users.value, user]

    session.value = { email: e, loginAt: Date.now() }
    return { ok: true }
  }

  async function login(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
    const e = email.trim().toLowerCase()
    if (!isValidEmail(e)) return { ok: false, error: '邮箱格式不正确' }
    const user = users.value.find(u => u.email === e)
    if (!user) return { ok: false, error: '该邮箱未注册' }
    const ok = await verifyPassword(password, user.passwordHash)
    if (!ok) return { ok: false, error: '密码错误' }
    session.value = { email: e, loginAt: Date.now() }
    return { ok: true }
  }

  function logout(): void {
    session.value = null
  }

  return {
    users,
    session,
    currentUser,
    isLoggedIn,
    register,
    login,
    logout,
  }
})
