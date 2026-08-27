<template>
  <div class="charity-page">
    <header class="charity-header glass-card">
      <button class="back-btn" @click="router.back()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        <span>返回</span>
      </button>
      <h2 class="page-title">公益</h2>
      <div class="header-placeholder"></div>
    </header>
    <div class="charity-body">
      <div class="charity-container">
        <section class="charity-text">
          <svg class="heart-icon" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          <h2 class="charity-title">请作者喝杯奶茶</h2>
          <p class="charity-desc">随心就好，感谢你的心意 ☕</p>
        </section>
        <section class="charity-qrcode">
          <template v-if="qrExists">
            <img class="qrcode-img" :src="qrSrc" alt="收款码" @error="onQrError" />
          </template>
          <div v-else class="qrcode-placeholder">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <p>将收款码命名为 <code>charity-qr.webp</code> 放入 <code>public/</code> 目录</p>
          </div>
          <p class="qrcode-hint">微信</p>
        </section>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const qrSrc = `${import.meta.env.BASE_URL}charity-qr.webp`
const qrExists = ref(true)
function onQrError() {
  qrExists.value = false
}
</script>
<style scoped>
.charity-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: var(--spacing-md);

  padding-bottom: calc(var(--spacing-md) + env(safe-area-inset-bottom, 0px));
  gap: var(--spacing-sm);
}

.charity-header {
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
.back-btn:hover { color: var(--text-primary); border-color: var(--border-hover); }

.charity-header { position: relative; }
.page-title {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  font-size: var(--font-lg);
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  pointer-events: none;
}
.header-placeholder { display: none; }

.charity-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.1s ease;
}

.charity-container {
  max-width: 360px;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-lg);

  text-align: center;
}

.charity-text {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
}

.heart-icon {
  color: var(--color-rise);
  filter: drop-shadow(0 0 12px var(--color-rise-glow));
  animation: heartbeat 2s ease-in-out infinite;
}

@keyframes heartbeat {
  0%, 100% { transform: scale(1); }
  15% { transform: scale(1.15); }
  30% { transform: scale(1); }
  45% { transform: scale(1.1); }
}

.charity-title {
  font-size: var(--font-lg);
  font-weight: 800;
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-light));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  line-height: 1.4;

  text-align: center;
  margin: 0;
}

.charity-desc {
  font-size: var(--font-md);
  color: var(--text-secondary);
  line-height: 1.6;
  margin: var(--spacing-xs) 0 0;
  text-align: center;
}

.charity-qrcode {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  cursor: default;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.charity-qrcode:hover {
  transform: scale(1.03);
  box-shadow: var(--shadow-lg);
}

.charity-qrcode:active {
  transform: scale(0.97);
}

.qrcode-img {
  display: block;
  max-width: 320px;
  width: 100%;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-glow);
}

.qrcode-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
  color: var(--text-muted);
  font-size: var(--font-sm);
  text-align: center;
  padding: var(--spacing-lg);
}

.qrcode-placeholder code {
  color: var(--color-primary-light);
  background: var(--color-primary-glow);
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  font-size: var(--font-xs);
}

.qrcode-hint {
  font-size: var(--font-sm);
  color: var(--text-muted);
  text-align: center;
  margin: 0;
}

@media (max-width: 767px) {
  .charity-page {
    padding: var(--spacing-sm);
  }
  .charity-container {
    max-width: 360px;
    gap: var(--spacing-md);
  }
  .charity-title {
    font-size: var(--font-md);
  }
  .charity-desc {
    font-size: var(--font-sm);
  }
  .qrcode-img {
    max-width: 260px;
  }
}
</style>
