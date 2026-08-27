<template>
  <div class="settings-sub-page">
    <header class="settings-header glass-card">
      <button class="back-btn" @click="router.back()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        <span>返回</span>
      </button>
      <h2 class="page-title">登录</h2>
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
          <h3 class="auth-title">欢迎回来</h3>
          <p class="auth-subtitle">登录后可同步身份标识</p>
        </div>
        <form class="auth-form" @submit.prevent="handleLogin">
          <div class="form-field">
            <label class="field-label">邮箱</label>
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
                :disabled="loading"
                @keyup.enter="handleLogin"
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
                placeholder="请输入密码"
                autocomplete="current-password"
                :disabled="loading"
                @keyup.enter="handleLogin"
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
          <button type="submit" class="btn-base btn-primary auth-submit" :disabled="loading">
            {{ loading ? '登录中...' : '登录' }}
          </button>
        </form>
        <div class="auth-switch">
          <span>还没有账号？</span>
          <router-link to="/register" class="auth-link">立即注册</router-link>
        </div>
        <p class="auth-note text-muted">
          账号仅本机有效，用于身份标识，不影响基金自选与持仓数据
        </p>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">

defineOptions({ name: 'Login' })

import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore, isValidEmail } from '@/modules/auth/auth-store'
import { AUTH_CONFIG } from '@/config/constants'

const router = useRouter()
const authStore = useAuthStore()

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)

async function handleLogin(): Promise<void> {
  if (loading.value) return
  if (!email.value.trim()) { ElMessage.warning('请输入邮箱'); return }
  if (!isValidEmail(email.value)) { ElMessage.warning('邮箱格式不正确'); return }
  if (password.value.length < AUTH_CONFIG.PASSWORD_MIN_LEN) {
    ElMessage.warning(`密码至少 ${AUTH_CONFIG.PASSWORD_MIN_LEN} 位`)
    return
  }
  loading.value = true
  try {
    const res = await authStore.login(email.value, password.value)
    if (res.ok) {
      ElMessage.success('登录成功')
      router.replace('/')
    } else {
      ElMessage.warning(res.error || '登录失败')
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
.auth-logo {
  display: flex;
  align-items: center;
  justify-content: center;
}
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

.auth-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}
.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field-label {
  font-size: var(--font-xs);
  font-weight: 500;
  color: var(--text-secondary);
}
.input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}
.input-icon {
  position: absolute;
  left: 12px;
  color: var(--text-muted);
  pointer-events: none;
  flex-shrink: 0;
}
.auth-input {
  width: 100%;
  padding-left: 38px;
  padding-right: 38px;
  height: 44px;
  font-size: var(--font-sm);
}
.pwd-toggle {
  position: absolute;
  right: 8px;
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
  transition: color var(--transition-fast);
}
.pwd-toggle:hover { color: var(--text-primary); }

.auth-submit {
  width: 100%;
  height: 44px;
  margin-top: var(--spacing-xs);
  font-size: var(--font-md);
  border-radius: var(--radius-md);
}
.auth-submit:disabled { opacity: 0.6; cursor: not-allowed; }

.auth-switch {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: var(--font-xs);
  color: var(--text-muted);
}
.auth-link {
  color: var(--color-primary-light);
  text-decoration: none;
  font-weight: 500;
  transition: color var(--transition-fast);
}
.auth-link:hover { color: var(--color-primary); }

.auth-note {
  font-size: 11px;
  text-align: center;
  line-height: 1.5;
  margin: 0;
}

@media (max-width: 767px) {
  .auth-card {
    padding: var(--spacing-lg);
    margin: var(--spacing-sm) 0;
  }
  .auth-title { font-size: var(--font-lg); }
}
</style>
