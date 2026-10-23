<script setup>
import { store, canGoToStep, goToStep } from '../store.js'

const steps = [
  { step: 1, label: 'Song' },
  { step: 2, label: 'Lyrics' },
  { step: 3, label: 'Sync' },
  { step: 4, label: 'Export' },
]

function stateOf(step) {
  if (step < store.step) return 'completed'
  if (step === store.step) return 'active'
  return ''
}
</script>

<template>
  <div class="flex items-center justify-between">
    <template v-for="(item, i) in steps">
      <div v-if="i > 0" class="step-connector"></div>
      <button
        class="step-indicator"
        :class="stateOf(item.step)"
        :disabled="!canGoToStep(item.step)"
        :title="canGoToStep(item.step) ? item.label : `${item.label} is not available yet`"
        @click="goToStep(item.step)"
      >
        <span class="step-num">{{ item.step }}</span>
        <span class="step-label">{{ item.label }}</span>
      </button>
    </template>
  </div>
</template>
