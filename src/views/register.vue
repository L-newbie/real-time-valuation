<template>
  <div class="settings-sub-page">
    <header class="settings-header glass-card">
      <button class="back-btn" @click="router.back()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        <span>返回</span>
      </button>
      <h2 class="page-title">注册</h2>
      <div class="header-placeholder"></div>
    </header>
    <div class="settings-body">
      <div class="auth-card glass-card animate-slide-up">
        <div class="auth-brand">
          <div class="auth-logo">
            <svg width="40" height="40" viewBox="0 0 100 100" fill="none">
              <ellipse cx="50" cy="60" rx="35" ry="30" fill="#ef4444" />
              <ellipse cx="50" cy="65" rx="22" ry="20" fill="#fca5a5" />
              <circle cx="50" cy="32" r="18" fill="#ef4444" />
              <circle cx="44" cy="29" r="5" fill="white" />
              <circle cx="44" cy="29" r="2.5" fill="var(--bg-base)" />
              <circle cx="56" cy="29" r="5" fill="white" />
              <circle cx="56" cy="29" r="2.5" fill="var(--bg-base)" />
              <polygon points="50,36 46,40 54,40" fill="#f97316" />
            </svg>
          </div>
          <h3 class="auth-title">创建账号</h3>
          <p class="auth-subtitle">邮箱验证后即可登录</p>
        </div>
        <form class="auth-form" @submit.prevent="handleRegister">
          <div class="form-field">
            <label class="field-label">邮箱</label>
            <div class="send-row">
              <div class="input-wrap">
                <svg class="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                <input
                  v-model="email"
                  type="email"
                  class="input-base auth-input"
                  placeholder="请输入邮箱"
                  autocomplete="email"
                  :disabled="loading || sending"
                />
              </div>
              <button
                type="button"
                class="btn-base send-btn"
                :disabled="!canSendNow || sending"
                @click="handleSendCode"
              >
                {{ sending ? '发送中...' : sendBtnText }}
              </button>
            </div>
          </div>
          <div class="form-field">
            <label class="field-label">验证码</label>
            <div class="code-boxes">
              <input
                v-for="(_, i) in CODE_LENGTH"
                :key="i"
                :ref="el => setCodeRef(el, i)"
                v-model="codeDigits[i]"
                type="tel"
                inputmode="numeric"
                maxlength="1"
                class="code-box"
                :class="{ filled: codeDigits[i] }"
                :disabled="loading"
                @input="onCodeInput(i)"
                @keydown="onCodeKeydown($event, i)"
                @paste="onCodePaste"
              />
            </div>
          </div>
          <div class="form-field">
            <label class="field-label">昵称<span class="field-optional">（选填）</span></label>
            <div class="input-wrap">
              <svg class="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <input
                v-model="nickname"
                type="text"
                class="input-base auth-input"
                placeholder="不填则用邮箱前缀"
                maxlength="20"
                :disabled="loading"
              />
            </div>
          </div>
          <div class="form-field">
            <label class="field-label">密码</label>
            <div class="input-wrap">
              <svg class="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <input
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                class="input-base auth-input"
                :placeholder="`至少 ${PASSWORD_MIN_LEN} 位`"
                autocomplete="new-password"
                :disabled="loading"
              />
              <button type="button" class="pwd-toggle" :title="showPassword ? '隐藏' : '显示'" @click="showPassword = !showPassword">
                <svg v-if="showPassword" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              </button>
            </div>
          </div>
          <div class="form-field">
            <label class="field-label">确认密码</label>
            <div class="input-wrap">
              <svg class="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <input
                v-model="confirmPassword"
                :type="showPassword ? 'text' : 'password'"
                class="input-base auth-input"
                placeholder="再次输入密码"
                autocomplete="new-password"
                :disabled="loading"
              />
            </div>
          </div>
          <button type="submit" class="btn-base btn-primary auth-submit" :disabled="loading">
            {{ loading ? '注册中...' : '注册并登录' }}
          </button>
        </form>
        <div class="auth-switch">
          <span>已有账号？</span>
          <router-link to="/login" class="auth-link">去登录</router-link>
        </div>
        <p class="auth-note text-muted">
          验证码 5 分钟内有效；账号仅本机有效，用于身份标识
        </p>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">

defineOptions({ name: 'Register' })

import { ref, computed, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore, isValidEmail } from '@/modules/auth/auth-store'
import { AUTH_CONFIG, EMAILJS_CONFIG } from '@/config/constants'
import { issueCode, consumeCode } from '@/modules/auth/verify-code'
import { sendVerifyCodeEmail } from '@/modules/auth/email-service'

const router = useRouter()
const authStore = useAuthStore()

const PASSWORD_MIN_LEN = AUTH_CONFIG.PASSWORD_MIN_LEN
const CODE_LENGTH = AUTH_CONFIG.CODE_LENGTH

const email = ref('')
const codeDigits = ref<string[]>(Array(CODE_LENGTH).fill(''))
const nickname = ref('')
const password = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const loading = ref(false)
const sending = ref(false)

const countdown = ref(0)
let countdownTimer: ReturnType<typeof setInterval> | null = null

const codeRefs: HTMLInputElement[] = []

function setCodeRef(el: Element | null | { el?: HTMLInputElement } | unknown, i: number): void {
  const node = (el && typeof el === 'object' && '$el' in el
    ? (el as { $el: HTMLInputElement }).$el
    : el) as HTMLInputElement | null
  if (node) codeRefs[i] = node
}

const fullCode = computed(() => codeDigits.value.join(''))
const canSendNow = computed(() => countdown.value === 0 && !!email.value.trim())
const sendBtnText = computed(() => countdown.value > 0 ? `${countdown.value}s 后重发` : '发送验证码')

function startCountdown(sec: number): void {
  countdown.value = sec
  if (countdownTimer) clearInterval(countdownTimer)
  countdownTimer = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) {
      countdown.value = 0
      if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null }
    }
  }, 1000)
}

onUnmounted(() => {
  if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null }
})

async function handleSendCode(): Promise<void> {
  if (sending.value || countdown.value > 0) return
  if (!email.value.trim()) { ElMessage.warning('请输入邮箱'); return }
  if (!isValidEmail(email.value)) { ElMessage.warning('邮箱格式不正确'); return }

  const issued = issueCode(email.value)
  if (!issued.ok) {
    startCountdown(issued.waitSec)
    ElMessage.warning(`发送过快，请 ${issued.waitSec}s 后重试`)
    return
  }

  sending.value = true
  try {
    const res = await sendVerifyCodeEmail(email.value, issued.code, EMAILJS_CONFIG.CODE_EXPIRE_MIN)
    if (res.sent) {
      ElMessage.success('验证码已发送，请查收邮箱')
    } else if (res.fallbackHint) {
      ElMessage({ message: res.fallbackHint, type: 'info', duration: 3000 })
    }
    startCountdown(EMAILJS_CONFIG.RESEND_LIMIT_SEC)
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '验证码发送失败')
  } finally {
    sending.value = false
  }
}

function onCodeInput(i: number): void {
  const val = codeDigits.value[i]

  if (val && !/^\d$/.test(val)) {
    codeDigits.value[i] = val.replace(/\D/g, '').slice(-1) || ''
  }
  if (codeDigits.value[i] && i < CODE_LENGTH - 1) {
    codeRefs[i + 1]?.focus()
  }
}

function onCodeKeydown(e: KeyboardEvent, i: number): void {
  if (e.key === 'Backspace' && !codeDigits.value[i] && i > 0) {
    codeRefs[i - 1]?.focus()
  }
  if (e.key === 'ArrowLeft' && i > 0) codeRefs[i - 1]?.focus()
  if (e.key === 'ArrowRight' && i < CODE_LENGTH - 1) codeRefs[i + 1]?.focus()
}

function onCodePaste(e: ClipboardEvent): void {
  e.preventDefault()
  const text = (e.clipboardData?.getData('text') || '').replace(/\D/g, '')
  if (!text) return
  for (let i = 0; i < CODE_LENGTH; i++) {
    codeDigits.value[i] = text[i] || ''
  }
  const focusIdx = Math.min(text.length, CODE_LENGTH - 1)
  codeRefs[focusIdx]?.focus()
}

async function handleRegister(): Promise<void> {
  if (loading.value) return
  if (!email.value.trim()) { ElMessage.warning('请输入邮箱'); return }
  if (!isValidEmail(email.value)) { ElMessage.warning('邮箱格式不正确'); return }
  if (fullCode.value.length !== CODE_LENGTH) { ElMessage.warning('请输入完整验证码'); return }
  if (password.value.length < PASSWORD_MIN_LEN) {
    ElMessage.warning(`密码至少 ${PASSWORD_MIN_LEN} 位`); return
  }
  if (password.value !== confirmPassword.value) {
    ElMessage.warning('两次密码不一致'); return
  }

  const codeRes = consumeCode(email.value, fullCode.value)
  if (codeRes === 'NOT_FOUND') { ElMessage.warning('请先发送验证码'); return }
  if (codeRes === 'EXPIRED') { ElMessage.warning('验证码已过期，请重新发送'); return }
  if (codeRes === 'INVALID') { ElMessage.warning('验证码错误'); return }

  loading.value = true
  try {
    const res = await authStore.register(email.value, password.value, nickname.value)
    if (res.ok) {
      ElMessage.success('注册成功，已自动登录')
      router.replace('/')
    } else {
      ElMessage.warning(res.error || '注册失败')
    }
  } finally {
    loading.value = false
  }
}
</script>
<style scoped>

.auth-card {
  padding: var(--spacing-xl);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  max-width: 420px;
  margin: var(--spacing-lg) auto;
}
.auth-brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
  padding-bottom: var(--spacing-md);
  border-bottom: 1px solid var(--border-subtle);
}
.auth-logo { display: flex; align-items: center; justify-content: center; }
.auth-title {
  font-size: var(--font-xl);
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}
.auth-subtitle {
  font-size: var(--font-xs);
  color: var(--text-muted);
  margin: 0;
}
.auth-form { display: flex; flex-direction: column; gap: var(--spacing-md); }
.form-field { display: flex; flex-direction: column; gap: 6px; }
.field-label {
  font-size: var(--font-xs);
  font-weight: 500;
  color: var(--text-secondary);
}
.field-optional {
  color: var(--text-muted);
  font-weight: 400;
  margin-left: 4px;
}
.input-wrap { position: relative; display: flex; align-items: center; }
.input-icon {
  position: absolute; left: 12px; color: var(--text-muted);
  pointer-events: none; flex-shrink: 0;
}
.auth-input {
  width: 100%; padding-left: 38px; padding-right: 38px;
  height: 44px; font-size: var(--font-sm);
}
.pwd-toggle {
  position: absolute; right: 8px;
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border: none; background: transparent;
  color: var(--text-muted); cursor: pointer;
  border-radius: var(--radius-sm); transition: color var(--transition-fast);
}
.pwd-toggle:hover { color: var(--text-primary); }
.auth-submit {
  width: 100%; height: 44px; margin-top: var(--spacing-xs);
  font-size: var(--font-md); border-radius: var(--radius-md);
}
.auth-submit:disabled { opacity: 0.6; cursor: not-allowed; }
.auth-switch {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  font-size: var(--font-xs); color: var(--text-muted);
}
.auth-link {
  color: var(--color-primary-light); text-decoration: none;
  font-weight: 500; transition: color var(--transition-fast);
}
.auth-link:hover { color: var(--color-primary); }
.auth-note { font-size: 11px; text-align: center; line-height: 1.5; margin: 0; }

.send-row { display: flex; gap: var(--spacing-sm); align-items: stretch; }
.send-row .input-wrap { flex: 1; min-width: 0; }
.send-btn {
  flex-shrink: 0; padding: 0 14px; height: 44px;
  font-size: var(--font-xs); white-space: nowrap;
  color: var(--color-primary-light);
  border-color: var(--color-primary);
}
.send-btn:hover:not(:disabled) {
  background: var(--color-primary-glow);
  border-color: var(--color-primary);
}
.send-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.code-boxes {
  display: flex;
  gap: var(--spacing-sm);
  justify-content: space-between;
}
.code-box {
  flex: 1;
  height: 48px;
  min-width: 0;
  text-align: center;
  font-size: var(--font-xl);
  font-weight: 600;
  font-family: var(--font-mono);
  background: var(--bg-input);
  border: 1.5px solid var(--border-default);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  outline: none;
  transition: all var(--transition-fast);
  padding: 0;
}
.code-box:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-glow);
}
.code-box.filled {
  border-color: var(--color-primary);
  background: var(--color-primary-glow);
}
.code-box:disabled { opacity: 0.6; }

@media (max-width: 767px) {
  .auth-card { padding: var(--spacing-lg); margin: var(--spacing-sm) 0; }
  .auth-title { font-size: var(--font-lg); }
  .code-box { height: 44px; font-size: var(--font-lg); }
  .send-btn { padding: 0 10px; font-size: 11px; }
}
</style>
