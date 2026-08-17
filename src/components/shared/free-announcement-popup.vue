<template>
  <el-dialog v-model="visible" width="420px" :show-close="false" :close-on-click-modal="false" class="announcement-dialog">
    <div class="announcement-content">
      <div class="announcement-glow"></div>
      <div class="announcement-icon">
        <svg width="64" height="64" viewBox="0 0 100 100" fill="none">
          <defs>
            <linearGradient id="iconGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="var(--color-primary)"/>
              <stop offset="100%" stop-color="var(--color-accent)"/>
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="45" fill="url(#iconGrad)" opacity="0.15"/>
          <text x="50" y="62" text-anchor="middle" font-size="48">✨</text>
        </svg>
      </div>
      <h2 class="announcement-title">AI 实现共享</h2>
      <p class="announcement-sub">智能追踪 · 实时估值 · 省心省力</p>
      <div class="announcement-features">
        <span class="feature-item">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          实时基金估值
        </span>
        <span class="feature-item">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          全球指数行情
        </span>
        <span class="feature-item">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          财经资讯聚合
        </span>
      </div>
    </div>
    <template #footer>
      <button class="announcement-btn" @click="closePopup">开始使用</button>
    </template>
  </el-dialog>
</template>
<script setup lang="ts">
import { ref, onMounted } from 'vue'

const visible = ref(false)

onMounted(() => {
  const shown = sessionStorage.getItem('jgb_announcement_shown')
  if (!shown) {
    visible.value = true
  }
})

function closePopup(): void {
  visible.value = false
  sessionStorage.setItem('jgb_announcement_shown', '1')
}
</script>
<style scoped>
.announcement-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-lg) 0 var(--spacing-md);
  position: relative;
}

.announcement-glow {
  position: absolute;
  top: -20px;
  width: 200px;
  height: 200px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--color-primary-glow) 0%, transparent 70%);
  pointer-events: none;
}

.announcement-icon {
  animation: celebrateScale 0.6s ease-out both;
  position: relative;
  z-index: 1;
}

@keyframes celebrateScale {
  0% { transform: scale(0); opacity: 0; }
  60% { transform: scale(1.15); }
  100% { transform: scale(1); opacity: 1; }
}

.announcement-title {
  font-size: var(--font-2xl);
  font-weight: 800;
  background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
  background-size: 300% 300%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-align: center;
  animation: rainbowFlow 4s ease infinite;
  position: relative;
  z-index: 1;
}

@keyframes rainbowFlow {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

.announcement-sub {
  font-size: var(--font-sm);
  color: var(--text-muted);
  text-align: center;
  margin-bottom: var(--spacing-sm);
}

.announcement-features {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--bg-surface);
  border-radius: var(--radius-md);
  width: 100%;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: var(--font-sm);
  color: var(--text-secondary);
}

.feature-item svg {
  color: var(--color-primary);
  flex-shrink: 0;
}

.announcement-btn {
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-lg);
  font-size: var(--font-md);
  font-weight: 600;
  border: none;
  border-radius: var(--radius-md);
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark));
  color: #fff;
  cursor: pointer;
  transition: all 0.2s ease;
}

.announcement-btn:hover {
  background: linear-gradient(135deg, var(--color-primary-dark), var(--color-primary));
  box-shadow: 0 4px 16px var(--color-primary);
  transform: translateY(-1px);
}

.announcement-btn:active {
  transform: scale(0.98);
}
</style>
