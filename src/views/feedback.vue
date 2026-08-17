<template>
  <div class="fb-page">
    <header class="fb-header glass-card">
      <button class="back-btn" @click="router.back()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        <span>返回</span>
      </button>
      <h2 class="page-title">问题反馈</h2>
      <div class="header-placeholder"></div>
    </header>
    <div class="fb-body">
      <section class="fb-card glass-card">
        <span class="fb-label">反馈类型</span>
        <div class="type-list">
          <button
            v-for="t in CATEGORIES"
            :key="t"
            :class="['type-chip', { active: category === t }]"
            @click="category = t"
          >
            {{ t }}
          </button>
        </div>
      </section>
      <section class="fb-card glass-card">
        <div class="fb-label-row">
          <span class="fb-label">问题描述</span>
          <span class="fb-counter font-number">{{ content.length }}/{{ MAX_LEN }}</span>
        </div>
        <textarea
          v-model="content"
          class="fb-textarea"
          :maxlength="MAX_LEN"
          rows="7"
          placeholder="请描述你遇到的问题或建议。如果是数据显示异常，写清是哪只基金、什么时间、看到的现象，会更有助于排查。"
        ></textarea>
      </section>
      <section class="fb-card glass-card">
        <span class="fb-label">联系方式<span class="fb-optional">（选填）</span></span>
        <input
          v-model="contact"
          class="fb-input"
          maxlength="100"
          placeholder="邮箱／微信／QQ 均可，方便回复你"
        />
      </section>
      <button class="fb-submit" :disabled="!canSubmit || sending" @click="submit">
        <span v-if="sending" class="animate-breathe">提交中...</span>
        <span v-else-if="cooldownLeft > 0">请稍候 {{ cooldownLeft }}s</span>
        <span v-else>提交反馈</span>
      </button>
    </div>
  </div>
</template>
<script setup lang="ts">

import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { sendFeedbackEmail } from '@/modules/auth/email-service'
import { buildFeedbackBody } from '@/modules/feedback/feedback-diagnostics'
import { EMAILJS_CONFIG, STORAGE_KEYS } from '@/config/constants'
import { loadString, saveString } from '@/shared/cache/local-storage-io'

const router = useRouter()

const CATEGORIES = ['数据异常', '功能建议', '界面问题', '其他'] as const
const MAX_LEN = EMAILJS_CONFIG.FEEDBACK_MAX_LEN

const category = ref<string>(CATEGORIES[0])
const content = ref('')
const contact = ref('')
const sending = ref(false)

const cooldownLeft = ref(0)

const canSubmit = computed(() => content.value.trim().length >= 5 && cooldownLeft.value === 0)

function refreshCooldown(): void {
  const last = Number(loadString(STORAGE_KEYS.FEEDBACK_LAST_SENT) || 0)
  if (!last) { cooldownLeft.value = 0; return }
  const passed = Math.floor((Date.now() - last) / 1000)
  cooldownLeft.value = Math.max(0, EMAILJS_CONFIG.FEEDBACK_COOLDOWN_SEC - passed)
}

let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  refreshCooldown()
  timer = setInterval(refreshCooldown, 1000)
})
onUnmounted(() => {
  if (timer) { clearInterval(timer); timer = null }
})

async function submit(): Promise<void> {
  if (!canSubmit.value || sending.value) return
  sending.value = true
  try {
    const body = buildFeedbackBody(content.value, contact.value, category.value)
    await sendFeedbackEmail(`[基攻宝反馈] ${category.value}`, body)
    saveString(STORAGE_KEYS.FEEDBACK_LAST_SENT, String(Date.now()))
    refreshCooldown()
    content.value = ''
    contact.value = ''
    ElMessage.success('反馈已提交，感谢你的反馈！')
    router.back()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '提交失败，请稍后重试')
  } finally {
    sending.value = false
  }
}
</script>
<style scoped>
.fb-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: var(--spacing-md);

  padding-bottom: calc(var(--spacing-md) + env(safe-area-inset-bottom, 0px));
  gap: var(--spacing-sm);
}

.fb-header {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  flex-shrink: 0;
}
.back-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: var(--radius-full);
  border: 1px solid var(--border-default);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: var(--font-xs);
  transition: all var(--transition-fast);
}
.back-btn:hover {
  color: var(--text-primary);
  border-color: var(--border-hover);
}
.page-title {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  margin: 0;
  pointer-events: none;
  font-size: var(--font-lg);
  font-weight: 700;
  color: var(--text-primary);
  text-align: center;
}
.header-placeholder { display: none; }

.fb-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding-bottom: var(--spacing-sm);
}

.fb-card {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm) var(--spacing-md);
}
.fb-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.fb-label {
  font-size: var(--font-sm);
  font-weight: 600;
  color: var(--text-primary);
}
.fb-optional {
  font-size: var(--font-xs);
  font-weight: 400;
  color: var(--text-muted);
}
.fb-counter {
  font-size: var(--font-xs);
  color: var(--text-muted);
}

.type-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
}
.type-chip {
  padding: 4px 12px;
  border-radius: var(--radius-full);
  border: 1px solid var(--border-default);
  background: transparent;
  color: var(--text-muted);
  font-size: var(--font-xs);
  cursor: pointer;
  transition: all var(--transition-fast);
}
.type-chip:hover { border-color: var(--border-hover); }
.type-chip.active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: #fff;
  font-weight: 600;
}

.fb-textarea, .fb-input {
  width: 100%;
  padding: 8px 10px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
  background: var(--bg-input, var(--border-default));
  color: var(--text-primary);
  font-size: var(--font-sm);
  font-family: inherit;
  resize: vertical;
  transition: border-color var(--transition-fast);
}
.fb-textarea:focus, .fb-input:focus {
  outline: none;
  border-color: var(--color-primary);
}
.fb-textarea::placeholder, .fb-input::placeholder {
  color: var(--text-muted);
}

.fb-submit {
  flex-shrink: 0;
  padding: 11px;
  border-radius: var(--radius-md);
  border: none;
  background: var(--color-primary);
  color: #fff;
  font-size: var(--font-sm);
  font-weight: 600;
  cursor: pointer;
  transition: opacity var(--transition-fast);
}
.fb-submit:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.fb-submit:not(:disabled):hover { opacity: 0.88; }
</style>
