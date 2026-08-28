<template>
  <BottomSheet :visible="visible" :title="title" center roomy @update:visible="$emit('update:visible', $event)">
    <div class="ifs" :class="{ 'is-centered': centerText }">
      <div v-if="lead" class="ifs-lead">
        <span v-if="icon" class="ifs-lead-icon" v-html="icon" />
        <p class="ifs-lead-text">{{ lead }}</p>
      </div>
      <div v-if="image" class="ifs-image">
        <img :src="image" :alt="title" class="ifs-img" decoding="async" fetchpriority="high" @error="imgBroken = true" />
        <p v-if="imgBroken" class="ifs-img-fallback">图片未就绪</p>
      </div>
      <div v-if="rows.length > 0" class="ifs-rows">
        <div v-for="r in rows" :key="r.label" class="ifs-row">
          <span class="ifs-label">{{ r.label }}</span>
          <a
            v-if="r.href"
            class="ifs-value ifs-link"
            :href="r.href"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ r.value }}
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          </a>
          <span v-else class="ifs-value" :class="[r.tone, { 'font-number': r.numeric !== false }]">{{ r.value }}</span>
        </div>
      </div>
      <div v-if="paragraphs.length > 0" class="ifs-paras">
        <p v-for="(t, i) in paragraphs" :key="i" class="ifs-p">{{ t }}</p>
      </div>
      <div v-if="actions.length > 0" class="ifs-acts">
        <button
          v-for="a in actions"
          :key="a.key"
          class="ifs-act"
          :class="{ 'is-primary': a.primary }"
          @click="$emit('action', a.key)"
        >
          {{ a.label }}
          <svg v-if="!a.primary" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
    </div>
  </BottomSheet>
</template>
<script setup lang="ts">
import { ref, watch } from 'vue'
import BottomSheet from '@/components/shared/bottom-sheet.vue'

export interface InfoRow {
  label: string
  value: string

  tone?: string

  numeric?: boolean

  href?: string
}

export interface InfoAction {
  key: string
  label: string

  primary?: boolean
}

const props = withDefaults(defineProps<{
  visible: boolean
  title: string

  lead?: string

  icon?: string
  image?: string
  rows?: InfoRow[]
  paragraphs?: string[]
  actions?: InfoAction[]

  centerText?: boolean
}>(), {
  lead: '',
  icon: '',
  image: '',
  rows: () => [],
  paragraphs: () => [],
  actions: () => [],
  centerText: false,
})

defineEmits<{
  'update:visible': [v: boolean]
  action: [key: string]
}>()

const imgBroken = ref(false)

watch(() => props.image, () => { imgBroken.value = false })
</script>
<style scoped>
.ifs { display: flex; flex-direction: column; gap: var(--spacing-lg); }

.ifs-lead {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  border-radius: var(--radius-lg);
  background: var(--color-primary-glow);
}
.ifs-lead-icon { display: inline-flex; color: var(--color-primary); flex-shrink: 0; margin-top: 1px; }
.ifs-lead-text {
  margin: 0;
  font-size: var(--font-sm);
  color: var(--text-primary);
  line-height: 1.75;
  font-weight: 500;
}

.ifs.is-centered .ifs-lead {
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-xl) var(--spacing-lg);
}
.ifs.is-centered .ifs-lead-icon { margin-top: 0; }
.ifs.is-centered .ifs-p { text-align: center; }

.ifs-image {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  border-radius: var(--radius-lg);
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
}
.ifs-img {
  width: min(180px, 44vw);
  height: min(180px, 44vw);
  object-fit: contain;
  border-radius: var(--radius-md);
  background: #fff;
  padding: var(--spacing-sm);
}
.ifs-img-fallback { margin: 0; font-size: var(--font-xs); color: var(--text-muted); }

.ifs-rows {
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-lg);
  background: var(--bg-surface);
  overflow: hidden;
}
.ifs-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  padding: var(--spacing-md) var(--spacing-lg);
  min-height: 48px;
}
.ifs-row + .ifs-row { border-top: 1px solid var(--border-subtle); }
.ifs-label { font-size: var(--font-sm); color: var(--text-muted); flex-shrink: 0; }
.ifs-value {
  font-size: var(--font-sm);
  font-weight: 600;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
  text-align: right;

  word-break: break-word;
}

.ifs-paras { display: flex; flex-direction: column; gap: var(--spacing-md); }
.ifs-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--color-primary);
  text-decoration: none;
  transition: color var(--transition-fast);
}
.ifs-link:hover { color: var(--color-primary-light); text-decoration: underline; }

.ifs-p {
  margin: 0;
  font-size: var(--font-sm);
  color: var(--text-muted);
  line-height: 1.85;
}

.ifs-acts { display: flex; flex-direction: column; gap: var(--spacing-sm); padding-top: var(--spacing-xs); margin-top: auto; }
.ifs-act {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 13px var(--spacing-md);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--font-sm);
  font-weight: 600;
  cursor: pointer;
  transition: background-color var(--transition-fast), border-color var(--transition-fast),
              color var(--transition-fast);
}
.ifs-act:hover { background: var(--bg-card-hover); color: var(--text-primary); border-color: var(--border-hover); }
.ifs-act.is-primary {
  border-color: transparent;
  background: var(--color-primary);
  color: var(--color-on-primary);
}
.ifs-act.is-primary:hover { background: var(--color-primary-light); color: var(--color-on-primary); }
</style>
