<template>
  <div class="gl-page">
    <div class="gl-body">
      <div class="gl-grid">
        <button
          v-for="(g, i) in GAMES"
          :key="g.id"
          type="button"
          class="gl-card"
          :style="{ '--gl-i': String(i), '--gl-h': String(hueOf(g.id)) }"
          @click="open(g)"
        >
          <span class="gl-halo" aria-hidden="true" />
          <span class="gl-scan" aria-hidden="true" />
          <span class="gl-art" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <rect x="8.5" y="4" width="7" height="10" rx="1.2" fill="currentColor" opacity="0.9" />
              <rect x="7.8" y="2.4" width="8.4" height="2.6" rx="1" fill="currentColor" />
              <circle cx="10.3" cy="7" r="1.1" fill="var(--bg-base)" />
              <circle cx="13.7" cy="7" r="1.1" fill="var(--bg-base)" />
              <path d="M10.6 9.5 C8.6 12.5, 8.4 17, 10 20.5 C10.7 22, 11.4 22, 11.8 20.5 C12.6 17, 12 12.5, 10.6 9.5 Z" fill="currentColor" opacity="0.55" />
              <path d="M13.4 9.5 C15.4 12.5, 15.6 17, 14 20.5 C13.3 22, 12.6 22, 12.2 20.5 C11.4 17, 12 12.5, 13.4 9.5 Z" fill="currentColor" opacity="0.55" />
            </svg>
          </span>
          <span class="gl-info">
            <span class="gl-badge">小游戏</span>
            <span class="gl-name">{{ g.name }}</span>
            <span class="gl-desc">{{ g.desc }}</span>
            <span class="gl-play">
              开始游戏
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </span>
          </span>
        </button>
      </div>
      <p v-if="GAMES.length === 0" class="gl-empty">暂无可玩的小游戏</p>
    </div>
  </div>
</template>
<script setup lang="ts">
defineOptions({ name: 'GameList' })

import { useRouter } from 'vue-router'
import { GAMES, type GameEntry } from '@/modules/game/game-registry'
import { markGameHintShown } from '@/modules/game/game-hint'

const router = useRouter()

function hueOf(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360
  return h
}

function open(g: GameEntry): void {
  markGameHintShown()
  router.push(g.path)
}
</script>
<style scoped>
.gl-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.gl-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-top: var(--spacing-md);
  padding-bottom: var(--spacing-md);
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.gl-body::-webkit-scrollbar { display: none; width: 0; }

.gl-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--spacing-md);
}
@media (min-width: 900px) {
  .gl-grid { grid-template-columns: repeat(2, 1fr); }
}

.gl-card {
  position: relative;
  display: block;
  width: 100%;
  height: 168px;
  padding: 0;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-subtle);
  background: linear-gradient(150deg, hsl(var(--gl-h, 35) 50% 45% / 0.14), var(--bg-card) 72%);
  color: var(--text-secondary);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  overflow: clip;
  transition: border-color var(--transition-fast),
              transform var(--transition-fast);
  animation: glIn var(--duration-normal) var(--ease-out-expo) backwards;
  animation-delay: calc(var(--gl-i, 0) * 80ms);
}
@keyframes glIn {
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: none; }
}
.gl-card:hover {
  border-color: hsl(var(--gl-h, 35) 62% 58% / 0.6);
  transform: translateY(-3px);
  box-shadow: var(--shadow-lg), 0 12px 34px hsl(var(--gl-h, 35) 55% 45% / 0.24);
}
.gl-card:active { transform: translateY(0); }

.gl-halo {
  position: absolute;
  right: -8%;
  top: 50%;
  transform: translateY(-50%);
  width: 62%;
  aspect-ratio: 1;
  border-radius: 50%;
  background: radial-gradient(circle, hsl(var(--gl-h, 35) 65% 55% / 0.28), transparent 66%);
  pointer-events: none;
}

.gl-scan {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    180deg,
    hsl(var(--gl-h, 35) 60% 70% / 0.05) 0px,
    hsl(var(--gl-h, 35) 60% 70% / 0.05) 1px,
    transparent 1px,
    transparent 4px
  );
  opacity: 0.7;
  pointer-events: none;
  transition: opacity var(--transition-fast);
}
.gl-card:hover .gl-scan { opacity: 1; }

.gl-art {
  position: absolute;
  right: 4%;
  top: 50%;
  transform: translateY(-50%);
  width: 132px;
  height: 132px;
  color: hsl(var(--gl-h, 35) 72% 62%);
  pointer-events: none;
  filter: drop-shadow(0 6px 20px hsl(var(--gl-h, 35) 65% 45% / 0.4));
  transition: transform var(--duration-normal) var(--ease-out-expo);
}
.gl-art svg { width: 100%; height: 100%; }
.gl-card:hover .gl-art { transform: translateY(-50%) scale(1.06) rotate(-4deg); }

.gl-info {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  height: 100%;

  padding: var(--spacing-md) 46% var(--spacing-md) var(--spacing-lg);
  justify-content: center;
}
.gl-badge {
  padding: 2px 9px;
  border-radius: var(--radius-full);
  background: hsl(var(--gl-h, 35) 60% 55% / 0.20);
  color: hsl(var(--gl-h, 35) 72% 68%);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
}
.gl-name {
  font-size: var(--font-xl);
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.01em;
}
.gl-desc {
  font-size: var(--font-xs);
  color: var(--text-muted);
  line-height: 1.5;
}
.gl-play {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin-top: 4px;
  padding: 6px 14px;
  border-radius: var(--radius-full);
  background: hsl(var(--gl-h, 35) 65% 55%);
  color: var(--bg-base);
  font-size: var(--font-xs);
  font-weight: 700;
  transition: gap var(--transition-fast);
}
.gl-card:hover .gl-play { gap: 7px; }

.gl-empty {
  margin: 0;
  padding: var(--spacing-lg) 0;
  text-align: center;
  font-size: var(--font-sm);
  color: var(--text-muted);
}

@media (max-width: 767px) {
  .gl-card { height: 148px; }
  .gl-art { width: 108px; }
  .gl-info { padding-left: var(--spacing-md); padding-right: 44%; }
  .gl-name { font-size: var(--font-lg); }
}

@media (max-height: 760px) and (min-width: 768px) {
  .gl-card { height: 132px; }
  .gl-art { width: 100px; }
}

</style>
