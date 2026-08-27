<template>
  <BottomSheet
    :visible="visible"
    title="问题反馈"
    center
    :mask-closable="false"
    @update:visible="$emit('update:visible', $event)"
  >
    <div class="fb">
      <div class="fb-field">
        <span class="fb-label">反馈类型</span>
        <div class="fb-cats">
          <button
            v-for="c in CATEGORIES"
            :key="c"
            type="button"
            class="fb-cat"
            :class="{ on: category === c }"
            @click="category = c"
          >{{ c }}</button>
        </div>
      </div>
      <div class="fb-field">
        <div class="fb-label-row">
          <span class="fb-label">问题描述</span>
          <span class="fb-count" :class="{ 'is-over': content.length > MAX_LEN }">
            {{ content.length }}/{{ MAX_LEN }}
          </span>
        </div>
        <textarea
          ref="textEl"
          v-model="content"
          class="fb-textarea"
          rows="5"
          :maxlength="MAX_LEN"
          placeholder="请描述你遇到的问题或建议。如果是数据显示异常，写清是哪只基金、什么时间、看到的现象，会更有助于排查。"
        />
      </div>
      <div class="fb-field">
        <span class="fb-label">联系方式（选填）</span>
        <input
          v-model="contact"
          type="text"
          class="fb-input"
          maxlength="60"
          placeholder="邮箱／微信／QQ 均可，方便回复你"
        />
      </div>
      <p class="fb-note">提交时会附带设备与版本等诊断信息，便于定位问题。</p>
    </div>
    <template #footer>
      <button class="fb-btn" @click="$emit('update:visible', false)">取消</button>
      <button class="fb-btn fb-btn-primary" :disabled="!canSubmit || sending" @click="submit">
        {{ submitText }}
      </button>
    </template>
  </BottomSheet>
</template>
<script setup lang="ts">
import { ref, computed, watch, onUnmounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import BottomSheet from '@/components/shared/bottom-sheet.vue'
import { sendFeedbackEmail } from '@/modules/auth/email-service'
import { buildFeedbackBody } from '@/modules/feedback/feedback-diagnostics'
import { EMAILJS_CONFIG, STORAGE_KEYS } from '@/config/constants'
import { loadString, saveString } from '@/shared/cache/local-storage-io'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ 'update:visible': [v: boolean] }>()

const CATEGORIES = ['数据异常', '功能建议', '界面问题', '其他'] as const
const MAX_LEN = EMAILJS_CONFIG.FEEDBACK_MAX_LEN

const MIN_LEN = 5

const textEl = ref<HTMLTextAreaElement | null>(null)
const category = ref<string>(CATEGORIES[0])
const content = ref('')
const contact = ref('')
const sending = ref(false)

const cooldownLeft = ref(0)

const canSubmit = computed(
  () => content.value.trim().length >= MIN_LEN && cooldownLeft.value === 0,
)

const submitText = computed(() => {
  if (sending.value) return '提交中…'
  if (cooldownLeft.value > 0) return `请稍候 ${cooldownLeft.value}s`
  return '提交'
})

function refreshCooldown(): void {
  const last = Number(loadString(STORAGE_KEYS.FEEDBACK_LAST_SENT) || 0)
  if (!last) { cooldownLeft.value = 0; return }
  const passed = Math.floor((Date.now() - last) / 1000)
  cooldownLeft.value = Math.max(0, EMAILJS_CONFIG.FEEDBACK_COOLDOWN_SEC - passed)
}

let timer: ReturnType<typeof setInterval> | null = null
function stopTimer(): void {
  if (timer) { clearInterval(timer); timer = null }
}

watch(() => props.visible, (v) => {
  if (v) {
    refreshCooldown()
    stopTimer()
    timer = setInterval(refreshCooldown, 1000)
    void nextTick(() => textEl.value?.focus())
  } else {
    stopTimer()
  }
})

onUnmounted(stopTimer)

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
    emit('update:visible', false)
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '提交失败，请稍后重试')
  } finally {
    sending.value = false
  }
}
</script>
<style scoped>
.fb { display: flex; flex-direction: column; gap: var(--spacing-md); }

.fb-field { display: flex; flex-direction: column; gap: 6px; }
.fb-label-row { display: flex; align-items: center; justify-content: space-between; }
.fb-label { font-size: var(--font-xs); color: var(--text-muted); font-weight: 500; }
.fb-count { font-size: 10px; color: var(--text-muted); font-variant-numeric: tabular-nums; }
.fb-count.is-over { color: var(--color-rise); }

.fb-cats { display: flex; flex-wrap: wrap; gap: 6px; }
.fb-cat {
  padding: 5px 14px;
  border-radius: var(--radius-full);
  border: 1px solid var(--border-default);
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--font-xs);
  font-weight: 600;
  cursor: pointer;
  transition: background-color var(--transition-fast), border-color var(--transition-fast),
              color var(--transition-fast);
}
.fb-cat:hover { border-color: var(--border-hover); color: var(--text-primary); }
.fb-cat.on {
  background: var(--color-primary);
  border-color: transparent;
  color: var(--color-on-primary);
}

.fb-textarea,
.fb-input {
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
  background: var(--bg-input);
  color: var(--text-primary);
  font-size: var(--font-sm);
  font-family: inherit;
  line-height: 1.55;
  outline: none;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}
.fb-textarea { resize: vertical; min-height: 96px; }
.fb-textarea:focus,
.fb-input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-glow);
}
.fb-textarea::placeholder,
.fb-input::placeholder { color: var(--text-muted); }

.fb-note {
  margin: 0;
  font-size: 10px;
  color: var(--text-muted);
  line-height: 1.5;
}

.fb-btn {
  flex: 1;
  padding: 11px var(--spacing-md);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--font-sm);
  font-weight: 600;
  cursor: pointer;
  transition: background-color var(--transition-fast), border-color var(--transition-fast),
              color var(--transition-fast), opacity var(--transition-fast);
}
.fb-btn:hover { background: var(--bg-card-hover); color: var(--text-primary); }
.fb-btn-primary {
  border-color: transparent;
  background: var(--color-primary);
  color: var(--color-on-primary);
}
.fb-btn-primary:hover:not(:disabled) { background: var(--color-primary-light); color: var(--color-on-primary); }
.fb-btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }
</style>
