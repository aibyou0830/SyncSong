<script setup>
import { onMounted, onUnmounted } from 'vue'
import { player, store } from './store.js'
import StepNav from './components/StepNav.vue'
import AudioPlayerPanel from './components/AudioPlayerPanel.vue'
import Step1 from './components/Step1.vue'
import Step2 from './components/Step2.vue'
import Step3 from './components/Step3.vue'
import Step4 from './components/Step4.vue'

// Global shortcuts live here so every step shares one listener.
function onGlobalKeydown(event) {
  if (event.code !== 'Space') return
  if (store.step !== 3) return

  const target = event.target
  if (target instanceof HTMLElement) {
    const tag = target.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA') return
  }

  event.preventDefault()
  player.togglePlay()
}

onMounted(() => document.addEventListener('keydown', onGlobalKeydown))
onUnmounted(() => document.removeEventListener('keydown', onGlobalKeydown))
</script>

<template>
  <header class="bg-slate-800 border-b border-slate-700 px-4 py-3">
    <div class="max-w-2xl mx-auto flex items-center justify-between">
      <h1 class="text-xl font-bold text-primary-400 flex items-center gap-2">
        <img src="/splitwave.svg" alt="" class="h-6 w-auto">
        SyncSong
      </h1>
    </div>
  </header>

  <nav class="bg-slate-800/50 border-b border-slate-700 px-4 py-3">
    <div class="max-w-2xl mx-auto">
      <StepNav />
    </div>
  </nav>

  <main class="flex-1 max-w-2xl mx-auto w-full p-4">
    <!-- The player stays mounted for the whole session so WaveSurfer is only
         created once; hiding it with `hidden` keeps the waveform alive. -->
    <AudioPlayerPanel />

    <section class="wizard-step">
      <Step1 v-if="store.step === 1" />
      <Step2 v-else-if="store.step === 2" />
      <Step3 v-else-if="store.step === 3" />
      <Step4 v-else />
    </section>
  </main>

  <footer class="bg-slate-800 border-t border-slate-700 px-4 py-2 text-center text-xs text-slate-500">
    © 2026 Joshua Hendricks. View on
    <a href="https://github.com/joshooaj/SyncSong" target="_blank" rel="noopener" class="text-slate-400 hover:text-primary-400 transition-colors">GitHub</a>.<br>
    Your files never leave your browser
  </footer>
</template>
