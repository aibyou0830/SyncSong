<script setup>
import { computed, ref, watch } from 'vue'
import { player, playerState, store, formatTime } from '../store.js'


// The player is only shown on the lyrics and sync steps, but the WaveSurfer
// instance must survive step changes, so the panel is hidden rather than unmounted.
const visible = computed(() => store.step === 2 || store.step === 3)

const waveformEl = ref(null)

watch(visible, (isVisible) => {
  if (isVisible && !player.wavesurfer && waveformEl.value) {
    player.init(waveformEl.value)
  }
})
</script>

<template>
  <div class="rounded-lg p-4 mb-4" :class="{ hidden: !visible }">
    <div class="flex items-center gap-3">
      <button
        class="w-11 h-11 rounded-full border-2 border-primary-400 text-primary-400 hover:bg-primary-400 hover:text-slate-900 flex items-center justify-center flex-shrink-0 transition-colors"
        aria-label="Play or pause"
        @click="player.togglePlay()"
      >
        <svg class="w-5 h-5 ml-0.5" viewBox="0 0 24 24" fill="currentColor" :class="{ hidden: playerState.isPlaying }">
          <path d="M8 5v14l11-7z" />
        </svg>
        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" :class="{ hidden: !playerState.isPlaying }">
          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
        </svg>
      </button>

      <div ref="waveformEl" class="flex-1 rounded overflow-hidden"></div>
    </div>

    <div class="flex items-center gap-4 mt-2">
      <span class="flex-1 text-sm text-slate-300 truncate">{{ playerState.trackName }}</span>

      <label class="flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
        <span>Auto-play</span>
        <div class="toggle-switch">
          <input type="checkbox" v-model="playerState.autoPlay">
          <span class="toggle-slider"></span>
        </div>
      </label>

      <div class="flex items-center gap-1 text-sm font-mono text-slate-300">
        <span>{{ formatTime(playerState.currentTime) }}</span>
        <span class="text-slate-600">/</span>
        <span>{{ formatTime(playerState.duration) }}</span>
      </div>
    </div>
  </div>
</template>
