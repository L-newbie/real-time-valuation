<template>
  <section class="sg" :class="{ 'is-open': open }">
    <button type="button" class="sg-head" :aria-expanded="open" @click="$emit('update:open', !open)">
      <span class="sg-title">{{ title }}</span>
      <span class="sg-arrow" aria-hidden="true">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </span>
    </button>
    <div class="sg-wrap">
      <div class="sg-clip">
        <div class="sg-body">
          <slot />
        </div>
      </div>
    </div>
  </section>
</template>
<script setup lang="ts">
defineProps<{
  title: string
  open: boolean
}>()

defineEmits<{ 'update:open': [v: boolean] }>()
</script>
<style scoped>
.sg {
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.sg-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: var(--spacing-md);
  border: none;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  text-align: left;
  transition: background-color var(--transition-fast);
}
.sg-head:hover { background: var(--bg-card-hover); }

.sg-title {
  font-size: var(--font-sm);
  font-weight: 600;
  letter-spacing: 0.02em;
}

.sg-arrow {
  display: inline-flex;
  color: var(--text-muted);
  transition: transform var(--duration-fast) var(--ease-out-expo);
}
.is-open .sg-arrow { transform: rotate(180deg); }

.sg-wrap {
  display: grid;
  grid-template-rows: 0fr;
}

.is-open .sg-wrap {
  grid-template-rows: 1fr;
  border-top: 1px solid var(--border-subtle);
}
.sg-clip { overflow: hidden; min-height: 0; }
.sg-body {
  padding: 0 var(--spacing-md) var(--spacing-sm);
  opacity: 0;
  transform: translate3d(0, -4px, 0);
  transition: opacity var(--duration-fast) var(--ease-out-expo),
              transform var(--duration-fast) var(--ease-out-expo);
}
.is-open .sg-body {
  opacity: 1;
  transform: none;
  transition-delay: 40ms;
}

</style>
