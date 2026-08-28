<template>
  <section :class="['settings-section', 'glass-card', { 'danger-section': danger }]">
    <h2 :class="['section-title', { 'danger-title': danger }]">{{ title }}</h2>
    <slot />
  </section>
</template>
<script setup lang="ts">

defineProps<{
  title: string
  danger?: boolean
}>()
</script>
<style scoped>
.settings-section {
  padding: var(--spacing-lg);
}

.section-title {
  font-size: var(--font-sm);
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: var(--spacing-md);
}

.danger-section {
  border-color: var(--color-rise-glow);
}

.danger-title {
  color: var(--color-rise) !important;
}
</style>
